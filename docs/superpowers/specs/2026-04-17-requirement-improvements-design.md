# 需求系统优化 Design Spec

**日期：** 2026-04-17  
**版本：** v1.0  
**项目：** my-agent

---

## 一、背景与问题

当前需求系统存在两个缺陷：

1. **相似度匹配失效**：`requirement_tool.py` 的 `_find_similar_requirement` 使用字符串包含匹配（`A in B or B in A`），当访客在同一会话内对同一需求做了更详细的描述时（如先说"人事合同提醒"，后说"人事合同到期前 7 天自动发企微和邮件提醒"），两段描述不满足包含关系，导致同一需求被存成两条独立记录。

2. **后台看板信息不足**：需求看板卡片只展示一行 `feature_desc` 概述，`use_case`、来源会话等关键信息无处查看，主人无法在后台了解需求全貌。

---

## 二、优化目标

- 用 LLM 语义判断替换字符串匹配，准确识别同一需求的不同措辞描述
- 在后台需求看板增加右侧抽屉，点击卡片可查看需求完整详情

---

## 三、优化点一：LLM 语义去重

### 3.1 整体流程

```
save_requirement 工具被调用
        │
        ▼
从数据库加载该 owner 的所有未拒绝需求，构建索引表
        │
        ▼
若索引表为空 → 直接创建新需求
        │
        ▼（索引表非空）
构建去重 prompt，发起一次独立 LLM API 调用
        │
        ├─ duplicate=true, matched_id=xxx → 更新已有需求（mention_count +1，补全空字段）
        └─ duplicate=false               → 创建新需求
```

### 3.2 索引表结构

每条已有需求在 prompt 中表示为一行：

```
- {req.id}: {req.feature_desc} | {req.use_case[:50] if req.use_case else "（无使用场景）"}
```

示例（动态拼接真实数据）：
```
- a1b2c3d4: 人事合同到期自动提醒 | HR 需要在合同到期前收到通知，避免遗漏
- e5f6g7h8: 搜索历史对话功能 | 用户想按关键词查找之前的对话记录
```

### 3.3 LLM 去重 Prompt 设计

**System 消息**（写死，不随数据变化）：
```
你是需求去重助手。
判断"新需求"是否与"已有需求列表"中的某条需求描述的是同一件事（即使措辞、详细程度不同）。
只返回 JSON，不要任何其他内容：{"duplicate": true或false, "matched_id": "匹配的需求id或null"}
```

**User 消息**（动态拼接）：
```
新需求："{args['feature_desc']}"

已有需求列表：
{动态拼接的索引表，每行一条}

判断新需求是否与列表中某条需求是同一件事。
```

### 3.4 LLM 调用方式

- 在 `RequirementTool` 内部直接使用 `Config` 中的 API 配置（`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`）发起独立 HTTP 请求
- `max_tokens=100`，`temperature=0`（需要确定性输出）
- 解析返回的 JSON，提取 `duplicate` 和 `matched_id`
- 若 LLM 调用失败或返回格式非法，**降级到创建新需求**（不阻断主流程）

### 3.5 更新逻辑（匹配到已有需求时）

与现有逻辑保持一致：
- `mention_count += 1`
- 若 `use_case` 为空且新请求提供了 `use_case`，则补全
- 若优先级不是默认 `medium` 且已有优先级是 `medium`，则更新优先级
- 更新 `updated_at`

### 3.6 修改范围

| 文件 | 变更 |
|------|------|
| `backend/tools/requirement_tool.py` | 删除 `_find_similar_requirement` 方法，新增 `_check_duplicate_with_llm` 方法，修改 `execute` 调用逻辑 |

---

## 四、优化点二：需求看板右侧抽屉

### 4.1 交互说明

- 点击任意需求卡片 → 从右侧滑出抽屉
- 点击抽屉外部区域 or 右上角 `×` 按钮 → 关闭抽屉
- 同一时间只有一个抽屉处于打开状态
- 抽屉打开时，背景内容仍可滚动（不加遮罩层）

### 4.2 抽屉内容（A 方案）

| 区域 | 内容 |
|------|------|
| 标题栏 | 优先级 badge + 状态 badge + `×` 关闭按钮 |
| 需求描述 | `feature_desc` 完整文本，支持换行 |
| 使用场景 | `use_case` 完整文本，若为空显示"暂无使用场景" |
| 提及次数 | `mention_count` 次，带图标 |
| 来源会话 | 显示访客名称，可点击跳转到会话管理页并高亮该会话 |

> **注：** 优先级和状态在抽屉内只读展示，修改操作仍保留在卡片上的下拉按钮。

### 4.3 样式规范

- 宽度：`w-96`（384px），与现有侧边栏宽度匹配
- 位置：固定在屏幕右侧，`fixed right-0 top-0 h-full`
- 背景：`bg-gray-800 border-l border-gray-700`，与现有深色主题一致
- 动画：`transform translate-x-full` → `translate-x-0`，CSS transition 0.3s
- 不引入新的 JS 库或 CSS 框架，纯 Tailwind + Vanilla JS

### 4.4 修改范围

| 文件 | 变更 |
|------|------|
| `frontend/owner-dashboard.html` | 新增抽屉 HTML 结构（在 `</body>` 前）；新增 `openRequirementDrawer(req)`、`closeRequirementDrawer()` JS 函数；修改需求卡片渲染函数，添加点击事件 |

---

## 五、不在本次范围内

- 需求抽屉内直接编辑 `feature_desc` / `use_case`（预留为后续 C 方案升级）
- 跨 owner 的需求去重
- 批量合并已有重复需求的工具
- 需求提醒通知（独立功能）

---

## 六、测试要点

### 优化点一

| 场景 | 预期结果 |
|------|----------|
| 同一需求不同措辞（如"合同提醒"和"合同到期自动通知"） | LLM 判断 duplicate=true，更新已有需求 |
| 完全不同的两个需求 | LLM 判断 duplicate=false，创建新需求 |
| 需求列表为空 | 跳过 LLM 调用，直接创建 |
| LLM 返回格式非法或调用失败 | 降级创建新需求，主流程不中断 |

### 优化点二

| 场景 | 预期结果 |
|------|----------|
| 点击需求卡片 | 抽屉从右侧滑入，显示完整需求信息 |
| 点击抽屉外部 | 抽屉滑出关闭 |
| 点击 × 按钮 | 抽屉滑出关闭 |
| 点击来源会话链接 | 跳转到会话管理页，高亮对应会话 |
| 需求无 use_case | 显示"暂无使用场景"占位文字 |
