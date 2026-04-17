# my-agent - Python 版本

一个基于 **Flask + SQLite + OpenAI Function Calling** 的个人 AI 助手平台。主人可以配置自己的 AI 分身，访客可以通过主页与 AI 对话，主人后台可实时查看会话并接管对话。

## 🎯 核心功能

### ✅ 已完成
- ✨ **访客对话**：支持 Markdown 渲染 + 打断重问功能
- 👤 **访客用户系统**：邮箱注册/登录，一个用户可拥有多个会话，支持查看历史会话和删除会话
- 🤖 **AI 工具调用**：集成 OpenAI Function Calling（时间查询、主人信息搜索、待办、网页搜索等）
- 📋 **需求收集系统**：AI 主动引导访客完善需求，结构化存储，支持需求看板管理
- 👤 **主人后台**：实时会话列表、消息查看、人工接管、需求看板
- 💾 **数据存储**：基于 SQLite 的关系型数据库（可迁移到 MySQL）
- 📝 **上下文管理**：保留最近 40 条对话记录
- 🎨 **UI 优化**：Tailwind CSS + FontAwesome 图标
- 🛠️ **工具自动加载**：放入 `backend/tools/` 目录即可自动注册

## 📡 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/Jenniahu/my-agent.git
cd my-agent
git checkout python_ver
```

### 2. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 OpenAI API Key
```

### 4. 启动服务

```bash
python app.py
```

### 5. 访问应用

- **访客页面**: http://localhost:5000/u/jennia
- **主人后台**: http://localhost:5000/owner/login
- **API 端点**: http://localhost:5000/api/ping

---

## 🛠️ 技术栈

- **后端框架**: Flask 3.0
- **前端**: Vanilla JS + Tailwind CSS + Marked.js
- **数据库**: SQLite (可迁移到 MySQL/PostgreSQL)
- **ORM**: SQLAlchemy 2.0
- **AI 模型**: MiniMax-M2.5 (通过 OpenAI 兼容端点)

---

## 📁 项目结构

```
my-agent/
├── backend/                      # Python 后端
│   ├── app.py                    # Flask 主应用
│   ├── config.py                 # 配置文件
│   ├── models.py                 # 数据模型
│   ├── requirements.txt          # Python 依赖
│   ├── .env.example              # 环境变量示例
│   ├── myagent.db                # SQLite 数据库（自动生成）
│   ├── routes/                   # API 路由
│   │   ├── session.py            # 会话管理
│   │   ├── message.py            # 消息管理
│   │   ├── owner.py              # 主人管理
│   │   └── visitor.py            # 访客用户管理
│   ├── services/                 # 业务逻辑
│   │   ├── ai_service.py         # AI 调用
│   │   └── tool_service.py       # 工具管理
│   ├── tools/                    # 工具实现
│   │   ├── base.py               # 工具基类
│   │   ├── time_tool.py          # 时间查询
│   │   ├── search_tool.py        # 信息搜索
│   │   ├── calculator_tool.py    # 计算器
│   │   ├── todo_tool.py          # 待办事项
│   │   ├── notification_tool.py  # 通知
│   │   ├── web_search_tool.py    # 网页搜索
│   │   └── requirement_tool.py   # 需求收集
│   └── utils/                    # 工具函数
│       └── helpers.py            # 辅助函数
│
├── frontend/                     # 前端页面
│   ├── index.html                # 首页
│   └── static/
│       ├── visitor-chat.js       # 访客页面 JS
│       └── style.css             # 自定义样式
│
├── docs/                         # 📚 项目文档
│   ├── PROJECT_PRD.md            # 项目 PRD
│   ├── PYTHON_IMPLEMENTATION.md  # Python 实现文档
│   ├── LOCAL_BACKEND_PRD.md      # 本地后端改造 PRD
│   ├── QUICK_REFERENCE.md        # 快速参考
│   ├── function-calling-explained.md  # 工具调用原理
│   ├── tool-examples.js          # 工具示例
│   └── TOOL_IMPLEMENTATION_SUMMARY.md # 工具实现总结
│
└── README.md                     # 本文档
```

---

## 🔧 核心 API

### 访客端 API

```bash
# 获取主人信息
GET /api/profile/<owner_id>

# 访客注册
POST /api/visitor/register
Body: {"email": "user@example.com", "password": "123456", "name": "访客"}

# 访客登录
POST /api/visitor/login
Body: {"email": "user@example.com", "password": "123456"}

# 创建会话（可选传入 visitorToken 关联用户）
POST /api/sessions
Body: {"ownerId": "jennia", "visitorName": "访客", "visitorToken": "xxx"}

# 发送消息并获取 AI 回复
POST /api/sessions/<id>/chat
Body: {"content": "现在几点了？"}

# 获取消息列表
GET /api/sessions/<id>/messages?since=2026-04-09T00:00:00Z

# 获取访客的所有会话
GET /api/visitor/sessions
Header: Authorization: Bearer <visitor_token>

# 删除访客的会话
DELETE /api/visitor/sessions/<id>
Header: Authorization: Bearer <visitor_token>
```

### 主人端 API

```bash
# 登录
POST /api/owner/login
Body: {"email": "jennia@example.com", "password": "password123"}

# 获取会话列表
GET /api/owner/sessions
Header: Authorization: Bearer <token>

# 人工回复
POST /api/owner/sessions/<id>/reply
Body: {"content": "我来回答你"}
Header: Authorization: Bearer <token>
```

---

## 🛠️ 如何添加新工具

### 步骤 1：创建工具文件

在 `backend/tools/` 目录下创建 `xxx_tool.py`：

```python
import json
from tools.base import BaseTool

class XxxTool(BaseTool):
    @property
    def name(self):
        return 'your_tool_name'
    
    @property
    def description(self):
        return '工具描述'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'param1': {
                    'type': 'string',
                    'description': '参数描述'
                }
            },
            'required': ['param1']
        }
    
    def execute(self, args, owner):
        # 实现工具逻辑
        result = do_something(args['param1'])
        return json.dumps({'result': result}, ensure_ascii=False)
```

### 步骤 2：重启服务

工具会自动加载，无需修改其他代码！

---

## 📊 数据模型

### Owner（主人）
- id, name, bio, avatar
- ai_name, ai_persona
- email, password_hash

### Visitor（访客用户）
- id, email, password_hash, name
- created_at

### Session（会话）
- id, owner_id, visitor_id (关联 Visitor), visitor_name
- status (active/taken_over/closed)

### Message（消息）
- id, session_id, role (visitor/ai/owner)
- content, created_at

### Token（登录凭证）
- token, owner_id, expires_at

### OnlineStatus（在线状态）
- owner_id, is_online, last_heartbeat

### RequirementConfig（需求收集配置）
- owner_id, enabled, strategy_prompt, fields_schema

### Requirement（需求记录）
- id, owner_id, session_id, message_id
- feature_desc, use_case, priority, status, mention_count

---

## 🧪 测试

```bash
# 健康检查
curl http://localhost:5000/api/ping

# 测试 AI 连接
curl -X POST http://localhost:5000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}'

# 创建会话并测试工具调用
SESSION_ID=$(curl -s -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}' | jq -r '.sessionId')

curl -X POST "http://localhost:5000/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}'
```

---

## 🐛 常见问题

### Q: 工具调用不生效？
1. 检查 `.env` 中的 `OPENAI_API_KEY`
2. 确认 API 端点支持 Function Calling
3. 查看控制台日志中的 `[AI]` 标记

### Q: 如何切换到 MySQL？
1. 安装驱动: `pip install pymysql`
2. 修改 `.env`: `DATABASE_URL=mysql+pymysql://...`
3. 创建数据库: `CREATE DATABASE myagent`
4. 重启服务

### Q: 如何部署到服务器？
```bash
# 使用 Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## 📖 完整文档

- **项目 PRD**: [docs/PROJECT_PRD.md](docs/PROJECT_PRD.md)
- **Python 实现**: [docs/PYTHON_IMPLEMENTATION.md](docs/PYTHON_IMPLEMENTATION.md)
- **工具调用原理**: [docs/function-calling-explained.md](docs/function-calling-explained.md)
- **快速参考**: [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md)

---

## 📝 变更日志

### v2.2.0 (2026-04-17) - 访客用户系统

**新增功能**：
- ✅ 访客注册/登录：邮箱密码注册，支持昵称
- ✅ 会话关联：登录后创建的会话自动关联到访客账号
- ✅ 历史会话：访客可查看与所有主人的对话记录
- ✅ 会话管理：支持删除历史会话

### v2.1.0 (2026-04-17) - 需求收集系统

**新增功能**：
- ✅ 需求收集系统：AI 主动引导访客完善需求
- ✅ 需求看板：主人后台可查看、筛选、管理需求
- ✅ 需求配置：支持自定义策略提示和开关控制
- ✅ 新增工具：todo、notification、web_search、requirement

### v2.0.0 (2026-04-09) - Python 版本

**架构升级**：
- ✅ 从 TypeScript + Cloudflare Pages 迁移到 Python + Flask
- ✅ 从 KV 存储迁移到 SQLite 关系型数据库
- ✅ 实现工具自动加载系统

**新增功能**：
- ✅ SQLAlchemy ORM 支持
- ✅ 工具基类和自动注册机制
- ✅ 完整的会话和消息管理 API
- ✅ 主人后台 API（登录、会话列表、人工回复）

---

## 📄 许可证

MIT License

---

## 👨‍💻 作者

- **Jennia** - AI 应用开发工程师
- **GitHub**: https://github.com/Jenniahu/my-agent
- **专注领域**: Workflow 搭建、RAG 系统、AI 原生应用

---

## 🙏 致谢

感谢以下开源项目：
- **Flask**: 轻量级 Python Web 框架
- **SQLAlchemy**: 强大的 Python ORM
- **Marked.js**: Markdown 渲染
- **Tailwind CSS**: 样式框架
