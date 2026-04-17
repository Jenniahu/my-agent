# my-agent 项目 - Claude Code 环境配置

> 本文件用于 Claude Code 开发时的环境注入，帮助 AI 理解项目架构和开发规范。

---

## 项目概述

my-agent 是一个基于 **Flask + SQLite + OpenAI Function Calling** 的个人 AI 助手平台。

- **访客对话**：支持 Markdown 渲染 + 打断重问功能
- **访客用户系统**：邮箱注册/登录，一个用户可拥有多个会话，支持查看历史会话和删除会话
- **AI 工具调用**：集成 OpenAI Function Calling（时间查询、主人信息搜索、需求收集等）
- **需求收集系统**：AI 主动引导访客完善需求，结构化存储并支持主人后台管理
- **主人后台**：实时会话列表、消息查看、人工接管、需求看板
- **数据存储**：基于 SQLite 的关系型数据库（可迁移到 MySQL）
- **上下文管理**：保留最近 40 条对话记录

---

## 技术栈

- **后端框架**: Flask 3.0
- **前端**: Vanilla JS + Tailwind CSS + Marked.js
- **数据库**: SQLite (可迁移到 MySQL/PostgreSQL)
- **ORM**: SQLAlchemy 2.0
- **AI 模型**: MiniMax-M2.5 (通过 OpenAI 兼容端点)

---

## 项目结构

```
my-agent/
├── backend/                      # Python 后端
│   ├── app.py                    # Flask 主应用
│   ├── config.py                 # 配置文件
│   ├── models.py                 # 数据模型（Owner, Session, Message, Token, OnlineStatus, RequirementConfig, Requirement）
│   ├── requirements.txt          # Python 依赖
│   ├── .env.example              # 环境变量示例
│   ├── myagent.db                # SQLite 数据库（自动生成）
│   ├── routes/                   # API 路由
│   │   ├── __init__.py
│   │   ├── session.py            # 会话管理 API
│   │   ├── message.py            # 消息管理 API
│   │   ├── owner.py              # 主人管理 API
│   │   └── visitor.py            # 访客用户 API
│   ├── services/                 # 业务逻辑
│   │   ├── ai_service.py         # AI 调用服务（OpenAI Function Calling）
│   │   └── tool_service.py       # 工具管理服务（自动加载）
│   ├── tools/                    # 工具实现
│   │   ├── base.py               # 工具基类（BaseTool）
│   │   ├── time_tool.py          # 时间查询工具
│   │   ├── search_tool.py        # 信息搜索工具
│   │   ├── calculator_tool.py    # 计算器工具
│   │   ├── todo_tool.py          # 待办事项工具
│   │   ├── notification_tool.py  # 通知工具
│   │   ├── web_search_tool.py    # 网页搜索工具
│   │   └── requirement_tool.py   # 需求收集工具
│   └── utils/
│       └── helpers.py            # 辅助函数
│
├── frontend/                     # 前端页面
│   ├── index.html                # 首页
│   └── static/
│       └── visitor-chat.js       # 访客页面 JS
│
├── docs/                         # 项目文档
│   ├── PROJECT_PRD.md
│   ├── PYTHON_IMPLEMENTATION.md
│   ├── LOCAL_BACKEND_PRD.md
│   └── QUICK_REFERENCE.md
│
├── migrations/                   # 数据库迁移
│   ├── 0001_init.sql
│   ├── 0002_seed.sql
│   ├── 0003_requirement_capture.sql  # 需求收集系统表结构
│   └── 0004_visitor_user.sql         # 访客用户系统表结构
│
└── README.md
```

---

## 环境配置

### 环境变量 (.env)

```bash
# OpenAI 配置
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://llm.mcisaas.com
OPENAI_MODEL=MiniMax-M2.5

# 数据库配置（SQLite 无需配置，MySQL 示例）
# DATABASE_URL=mysql://root:password@localhost:3306/myagent

# Flask 配置
SECRET_KEY=dev-secret-key-change-in-production
DEBUG=True

# CORS 配置
CORS_ORIGINS=*

# 服务器配置
HOST=0.0.0.0
PORT=5000
```

### 依赖安装

```bash
cd backend
pip install -r requirements.txt
```

### 启动命令

```bash
python app.py
```

服务器将在 `http://localhost:5000` 启动。

---

## 核心数据模型

### Owner（主人）
```python
- id: str (主键)
- name: str
- bio: str
- avatar: str
- ai_name: str
- ai_persona: str (AI人格设定)
- email: str
- password_hash: str
```

### Visitor（访客用户）
```python
- id: str (主键)
- email: str (唯一)
- password_hash: str
- name: str
- created_at: datetime
```

### Session（会话）
```python
- id: str (主键)
- owner_id: str (外键)
- visitor_id: str (外键，关联 Visitor)
- visitor_name: str
- status: str (active/taken_over/closed)
```

### Message（消息）
```python
- id: str (主键)
- session_id: str (外键)
- role: str (visitor/ai/owner)
- content: str
- created_at: datetime
```

### RequirementConfig（需求收集配置）
```python
- owner_id: str (主键, 外键)
- enabled: bool (是否启用需求收集)
- strategy_prompt: str (策略提示文本)
- fields_schema: JSON (字段定义)
- created_at / updated_at: datetime
```

### Requirement（需求记录）
```python
- id: str (主键)
- owner_id: str (外键)
- session_id: str (外键)
- message_id: str (外键, 触发需求的消息)
- feature_desc: str (功能描述)
- use_case: str (使用场景)
- priority: str (high/medium/low)
- status: str (pending/in_progress/done)
- mention_count: int (提及次数)
- created_at / updated_at: datetime
```

---

## API 端点

### 访客端 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/profile/<owner_id>` | GET | 获取主人公开信息 |
| `/api/sessions` | POST | 创建会话（支持传入 visitorToken 关联用户） |
| `/api/sessions/<id>/messages` | GET | 获取消息 |
| `/api/sessions/<id>/chat` | POST | 发送消息并获取 AI 回复 |
| `/api/sessions/<id>/check` | GET | 检查会话有效性 |

### 访客用户 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/visitor/register` | POST | 访客注册 |
| `/api/visitor/login` | POST | 访客登录 |
| `/api/visitor/profile` | GET | 获取当前访客信息 |
| `/api/visitor/sessions` | GET | 获取访客的所有会话 |
| `/api/visitor/sessions/<id>` | DELETE | 删除访客的会话 |

### 主人端 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/owner/login` | POST | 主人登录 |
| `/api/owner/logout` | POST | 主人登出 |
| `/api/owner/verify` | GET | 验证登录状态 |
| `/api/owner/profile` | GET/PUT | 获取/更新主人信息 |
| `/api/owner/sessions` | GET | 获取会话列表 |
| `/api/owner/sessions/<id>/reply` | POST | 主人回复 |
| `/api/owner/sessions/<id>/requirements` | GET | 获取会话的需求列表 |
| `/api/owner/heartbeat` | POST | 更新在线状态 |
| `/api/owner/requirement-config` | GET/PUT | 获取/更新需求收集配置 |
| `/api/owner/requirements` | GET | 获取需求列表（支持筛选） |
| `/api/owner/requirements/<id>` | PUT | 更新需求状态 |

---

## 工具系统

### 工具基类 (tools/base.py)

所有工具必须继承 `BaseTool` 并实现以下抽象方法：

```python
from abc import ABC, abstractmethod

class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述"""
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> dict:
        """工具参数（JSON Schema 格式）"""
        pass
    
    @abstractmethod
    def execute(self, args: dict, owner) -> str:
        """执行工具，返回 JSON 字符串"""
        pass
    
    def to_openai_format(self) -> dict:
        """转换为 OpenAI Function Calling 格式"""
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters
            }
        }
```

### 添加新工具的步骤

1. 在 `backend/tools/` 目录下创建 `xxx_tool.py` 文件
2. 继承 `BaseTool` 并实现所有抽象方法
3. 类名约定：`xxx_tool.py` → `XxxTool`
4. 重启服务，工具会自动加载

### 示例工具

```python
# tools/weather_tool.py
import json
from tools.base import BaseTool

class WeatherTool(BaseTool):
    @property
    def name(self):
        return 'get_weather'
    
    @property
    def description(self):
        return '查询指定城市的天气'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'city': {
                    'type': 'string',
                    'description': '城市名，如 北京、上海'
                }
            },
            'required': ['city']
        }
    
    def execute(self, args, owner):
        city = args.get('city')
        # 实现天气查询逻辑
        return json.dumps({
            'city': city,
            'temperature': 25,
            'weather': '晴天'
        }, ensure_ascii=False)
```

---

## AI 服务调用流程

1. **构建消息上下文**：系统提示 + 最近 40 条历史消息 + 新消息
2. **第一次调用 OpenAI**：传入工具列表，检测是否需要工具调用
3. **执行工具**：如果需要，执行所有工具调用并获取结果
4. **第二次调用 OpenAI**：传入工具结果，获取最终回复

```python
# services/ai_service.py 核心逻辑
class AIService:
    def chat(self, owner, messages, new_message):
        # 1. 构建消息
        openai_messages = self._build_messages(owner, messages, new_message)
        
        # 2. 获取工具列表
        tools = self.tool_service.get_all_tools()
        
        # 3. 第一次调用
        response = self._call_openai(openai_messages, tools)
        
        # 4. 检查工具调用
        if 'tool_calls' in response:
            # 执行工具
            tool_messages = []
            for tool_call in response['tool_calls']:
                result = self.tool_service.execute_tool(...)
                tool_messages.append({...})
            
            # 5. 第二次调用
            final_messages = openai_messages + [assistant_message] + tool_messages
            final_response = self._call_openai(final_messages, tools=None)
            return final_response['content']
        
        return response['content']
```

---

## 开发规范

### 代码风格

- 使用 Python 3.9+ 类型注解
- 遵循 PEP 8 规范
- 类名使用 PascalCase，函数/变量使用 snake_case
- 常量使用 UPPER_SNAKE_CASE

### 文件组织

- 路由放在 `routes/` 目录
- 业务逻辑放在 `services/` 目录
- 工具放在 `tools/` 目录
- 工具文件命名：`xxx_tool.py`
- 工具类命名：`XxxTool`

### 数据库操作

- 使用 SQLAlchemy ORM
- 模型定义在 `models.py`
- 外键关系使用 `back_populates`
- 重要字段添加索引

### 错误处理

- API 错误返回 JSON 格式：`{"error": "错误信息"}`
- 工具执行错误返回：`{"error": True, "message": "..."}`
- 使用 try-except 捕获异常并记录日志

---

## 测试账号

- **ID**: jennia
- **邮箱**: jennia@example.com
- **密码**: password123

---

## 常用命令

```bash
# 启动服务
cd backend && python app.py

# 健康检查
curl http://localhost:5000/api/ping

# 测试 AI
curl -X POST http://localhost:5000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}'

# 创建会话
SESSION_ID=$(curl -s -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}' | jq -r '.sessionId')

# 发送消息
curl -X POST "http://localhost:5000/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}'
```

---

## 访问路径

- **访客页面**: http://localhost:5000/u/jennia
- **主人后台**: http://localhost:5000/owner/login
- **API 端点**: http://localhost:5000/api/ping

---

## 部署说明

### 生产环境部署

```bash
# 安装 Gunicorn
pip install gunicorn

# 启动服务
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 数据库迁移到 MySQL

```bash
# 1. 安装驱动
pip install pymysql

# 2. 修改 .env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/myagent

# 3. 创建数据库
CREATE DATABASE myagent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. 重启服务（自动建表）
```

---

## 扩展开发指南

### 添加新 API 路由

```python
# routes/example.py
from flask import Blueprint, request, jsonify
from models import db

example_bp = Blueprint('example', __name__)

@example_bp.route('/api/example', methods=['GET'])
def example():
    return jsonify({'message': 'Hello'})
```

然后在 `app.py` 注册：
```python
from routes.example import example_bp
app.register_blueprint(example_bp)
```

### 修改 AI 人格

编辑 `app.py` 中的 `ai_persona` 字段，或在数据库中修改 `owners` 表的 `ai_persona` 字段。

---

## 注意事项

1. **工具自动加载**：`tools/` 目录下的 `*_tool.py` 文件会自动加载，无需手动注册
2. **上下文限制**：AI 对话保留最近 40 条消息
3. **Token 限制**：max_tokens=1500，temperature=0.7
4. **CORS 配置**：开发环境使用 `*`，生产环境应指定具体域名
5. **密钥安全**：生产环境必须修改 `SECRET_KEY`

---

## 文档索引

- **项目 PRD**: docs/PROJECT_PRD.md
- **Python 实现**: docs/PYTHON_IMPLEMENTATION.md
- **工具调用原理**: docs/function-calling-explained.md
- **快速参考**: docs/QUICK_REFERENCE.md

---

*最后更新: 2026-04-17*
*版本: v2.2.0*
