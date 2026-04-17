# 业务需求捕获系统 — 设计文档

**日期**: 2026-04-17  
**版本**: v1.0  
**状态**: 待实现

---

## 背景与目标

当前系统缺乏对访客业务需求的结构化捕获能力。访客表达需求时，AI 仅做普通回复，既不提取结构化信息，也不跟踪需求变化，主人无法系统性地了解访客诉求。

本设计实现一套**主动引导式需求捕获系统**，由 AI 在对话中自然引导访客完善需求，结构化存储后在主人后台提供双视图（会话内标注 + 独立看板）。

---

## 整体架构

三层职责分离：

```
策略层（System Prompt 片段，存储于数据库）
  ↓ 教 AI 何时识别需求意图、如何追问引导、如何拆解模糊表述
工具层（requirement_tool.py，Function Calling）
  ↓ 三字段收集完毕后调用，写入数据库
数据层（Requirement 表 + RequirementConfig 表）
  ↓ 存储结构化需求与主人配置
```

---

## 数据模型

### RequirementConfig（需求收集配置，每个主人一条）

```python
class RequirementConfig(db.Model):
    __tablename__ = 'requirement_configs'

    owner_id        = Column(String(50), ForeignKey('owners.id'), primary_key=True)
    enabled         = Column(Boolean, default=False)           # 全局开关
    strategy_prompt = Column(Text)                             # 注入 System Prompt 的策略文本（有默认值）
    fields_schema   = Column(JSON)                             # 字段定义，当前固定3字段，未来支持自定义
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

`fields_schema` 默认值：
```json
[
  {"key": "feature_desc", "label": "功能描述", "type": "text", "required": true},
  {"key": "use_case",     "label": "使用场景", "type": "text", "required": true},
  {"key": "priority",     "label": "优先级",   "type": "enum", "options": ["high", "medium", "low"], "required": true}
]
```

> **扩展说明**：未来主人自定义字段（方案C）时，仅需修改 `fields_schema`，工具层和策略层无需改代码。

### Requirement（结构化需求记录）

```python
class Requirement(db.Model):
    __tablename__ = 'requirements'

    id            = Column(String(50), primary_key=True)
    owner_id      = Column(String(50), ForeignKey('owners.id'), nullable=False)
    session_id    = Column(String(50), ForeignKey('sessions.id'), nullable=False)
    message_id    = Column(String(50), ForeignKey('messages.id'), nullable=False)  # 触发需求的那条访客消息
    feature_desc  = Column(Text, nullable=False)       # 功能描述
    use_case      = Column(Text, nullable=False)        # 使用场景
    priority      = Column(String(10), nullable=False)  # high / medium / low
    status        = Column(String(20), default='pending')  # pending / in_progress / done
    mention_count = Column(Integer, default=1)          # 同一需求被提到的次数
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 索引
    __table_args__ = (
        Index('idx_requirements_owner', 'owner_id'),
        Index('idx_requirements_session', 'session_id'),
        Index('idx_requirements_status', 'status'),
    )
```

---

## 策略层：System Prompt 注入

当 `RequirementConfig.enabled = True` 时，`ai_service.py` 在 `_build_messages()` 中将 `strategy_prompt` 追加到 System Prompt 末尾。

**默认策略文本**（存入数据库，主人可编辑）：

```
【需求收集模式已开启】
当你感知到访客有功能需求意图时（例如"我想要..."、"能不能..."、"如果有...就好了"等），
请主动引导访客完善需求，按以下顺序追问（每次只问一个问题，不要一次性全问）：
1. 功能描述：这个功能具体要做什么？
2. 使用场景：在什么情况下会用到它？
3. 优先级：这个需求对你来说紧急吗？（高/中/低）

当三个字段都收集完毕后，调用 save_requirement 工具保存，
并告知访客："好的，我已经记录下这个需求，主人会看到的！"

注意：
- 模糊表述需要先拆解再引导（如"自动化功能"要先确认具体指什么）
- 不要打断正常对话，需求收集应自然融入对话节奏
- 如果访客明确表示不想填写，礼貌跳过，不强制
```

---

## 工具层：save_requirement Tool

**文件**: `backend/tools/requirement_tool.py`  
**类名**: `RequirementTool`  
**工具名**: `save_requirement`

### Function Calling Schema

```json
{
  "name": "save_requirement",
  "description": "当访客的需求信息（功能描述、使用场景、优先级）已收集完整时调用，保存结构化需求到数据库",
  "parameters": {
    "type": "object",
    "properties": {
      "feature_desc": {
        "type": "string",
        "description": "功能描述，访客想要的功能是什么"
      },
      "use_case": {
        "type": "string",
        "description": "使用场景，在什么情况下会用到这个功能"
      },
      "priority": {
        "type": "string",
        "enum": ["high", "medium", "low"],
        "description": "优先级：high=高，medium=中，low=低"
      },
      "session_id": {
        "type": "string",
        "description": "当前会话ID"
      },
      "message_id": {
        "type": "string",
        "description": "触发需求的访客消息ID"
      }
    },
    "required": ["feature_desc", "use_case", "priority", "session_id", "message_id"]
  }
}
```

### 执行逻辑

1. 从 `RequirementConfig.fields_schema` 读取字段定义，验证传入参数
2. 在当前 `owner` 下查找 `feature_desc` 相似的已有需求（字符串包含匹配）
3. 若找到相似需求 → `mention_count += 1`，更新 `feature_desc`、`use_case`、`priority`
4. 若未找到 → 新建 `Requirement` 记录
5. 返回 JSON 字符串：`{"success": true, "requirement_id": "...", "is_new": true/false}`

---

## API 端点

### 配置管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/owner/requirement-config` | GET | 获取需求收集配置（含默认值） |
| `/api/owner/requirement-config` | PUT | 更新配置（enabled / strategy_prompt / fields_schema） |

### 需求管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/owner/requirements` | GET | 获取需求列表（支持 ?status=&priority= 筛选，按 mention_count 降序） |
| `/api/owner/requirements/<id>` | PUT | 更新需求状态 |
| `/api/owner/sessions/<id>/requirements` | GET | 获取某会话下的需求列表（供会话详情内标注用） |

---

## 前端视图

### 1. 会话详情内标注

- 含需求的访客消息旁显示 `📌 需求` 标签
- 点击展开结构化字段卡片：功能描述、使用场景、优先级标签、状态下拉
- 主人可在卡片上直接修改状态（pending → in_progress → done）
- 数据来源：`GET /api/owner/sessions/<id>/requirements`

### 2. 独立需求看板（新页面 `/owner/requirements`）

- 列表视图，按 `mention_count` 降序排列
- 每行显示：功能描述、使用场景、优先级标签、提及次数、来源会话链接、状态
- 顶部筛选：按优先级 / 按状态
- 顶部开关：需求收集模式 ON/OFF（PUT `/api/owner/requirement-config`）

### 3. 配置入口（Profile 页新增 Tab）

- 开关：启用/禁用需求收集
- 策略文本编辑框（textarea，可恢复默认模板按钮）
- 保存按钮

---

## 修改点汇总

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `backend/models.py` | 新增 | `RequirementConfig`、`Requirement` 两个模型 |
| `backend/tools/requirement_tool.py` | 新增 | `RequirementTool` 工具实现 |
| `backend/services/ai_service.py` | 修改 | `_build_messages()` 中按配置注入策略 prompt |
| `backend/routes/owner.py` | 修改 | 新增需求配置和需求管理 API 端点 |
| `frontend/index.html` / JS | 修改 | 会话详情内标注、需求看板页面、Profile 配置 Tab |
| `migrations/` | 新增 | `0003_requirement_capture.sql` 建表迁移 |

---

## 不在本期范围内

- 需求重复检测算法升级（当前用简单字符串匹配，未来可接向量相似度）
- 主人自定义字段（fields_schema 已预留，实现留待后续迭代）
- 需求导出（CSV/PDF）
- 需求与外部项目管理工具集成（Notion、Linear 等）
