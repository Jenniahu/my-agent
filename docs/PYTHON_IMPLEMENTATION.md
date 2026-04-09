# Python 本地后端开发方案 - 技术设计文档

## 📋 文档信息

**版本**: v2.0 - Python 本地开发版  
**创建日期**: 2026-04-09  
**作者**: Jennia  
**项目名称**: my-agent Python 后端改造  
**目标**: 将 Cloudflare Workers (TypeScript) 改造为 Python 本地后端，支持灵活的 Agent 扩展

---

## 1. 项目背景

### 1.1 为什么要改造？

**核心原因**：
- ❌ TypeScript 不熟悉，开发效率低
- ✅ Python 生态丰富，适合 Agent 开发
- ✅ 需要灵活扩展（文件上传、定时任务、复杂工具）
- ✅ 本地开发，方便调试和测试

### 1.2 当前架构（待替换）

```
┌─────────────────────────────────────┐
│   Cloudflare Pages (云端)           │
├─────────────────────────────────────┤
│ 前端: HTML/JS/CSS                   │
│ 后端: src/routes/api.ts (TS) ❌    │
│ 数据: Cloudflare KV ❌             │
└─────────────────────────────────────┘
```

### 1.3 目标架构（新架构）

```
┌─────────────────────────────────────┐
│   本地开发环境                       │
├─────────────────────────────────────┤
│ 前端: public/index.html (不变)     │
│ 后端: Python Flask + SQLite ✅     │
│ 数据: SQLite (本地文件数据库) ✅    │
└─────────────────────────────────────┘
```

---

## 2. 技术栈选择

### 2.1 后端框架：Flask（推荐）

**为什么选 Flask？**

| 优势 | 说明 |
|-----|------|
| ✅ **简单易学** | 100 行代码即可实现完整 API |
| ✅ **轻量级** | 核心库小，启动快 |
| ✅ **灵活** | 可按需添加功能（数据库、认证、缓存） |
| ✅ **生态好** | 大量插件（flask-cors、flask-jwt、flask-sqlalchemy） |
| ✅ **适合 Agent** | 易于集成 LangChain、OpenAI、第三方 API |

**备选方案**：FastAPI（如果熟悉 async/await，性能更好）

### 2.2 数据库：SQLite（推荐本地开发）

**为什么选 SQLite？**

| 优势 | 说明 |
|-----|------|
| ✅ **零配置** | 无需安装 MySQL/PostgreSQL |
| ✅ **单文件** | `myagent.db` 一个文件搞定 |
| ✅ **Python 内置** | `import sqlite3` 即用 |
| ✅ **支持 SQL** | 完整的关系型数据库功能 |
| ✅ **易迁移** | 后续可轻松切换到 MySQL/PostgreSQL |

**数据库路径**：`backend/myagent.db`（自动创建）

**后续升级路径**：
```
SQLite (本地开发)
  ↓
MySQL/PostgreSQL (生产环境)
  ↓
云数据库 (RDS/Supabase)
```

### 2.3 ORM：SQLAlchemy（推荐）

**为什么使用 ORM？**

```python
# 不用 ORM（原生 SQL）❌
cursor.execute("INSERT INTO messages (id, content) VALUES (?, ?)", (msg_id, content))

# 使用 ORM（面向对象）✅
message = Message(id=msg_id, content=content)
db.session.add(message)
db.session.commit()
```

**优势**：
- ✅ 自动建表（无需手写 SQL）
- ✅ 防 SQL 注入
- ✅ 易于切换数据库（SQLite → MySQL 只需改配置）

---

## 3. 项目结构设计

### 3.1 目录结构

```
my-agent-python/
├── backend/                      # Python 后端（新建）
│   ├── app.py                    # Flask 主应用入口
│   ├── config.py                 # 配置文件（数据库、API key）
│   ├── models.py                 # 数据模型（Owner、Session、Message）
│   ├── routes/                   # API 路由
│   │   ├── __init__.py
│   │   ├── session.py            # 会话相关 API
│   │   ├── message.py            # 消息相关 API
│   │   ├── owner.py              # 主人相关 API
│   │   └── tools.py              # 工具调用 API
│   ├── services/                 # 业务逻辑
│   │   ├── __init__.py
│   │   ├── ai_service.py         # OpenAI 调用服务
│   │   └── tool_service.py       # 工具执行服务
│   ├── tools/                    # 工具实现
│   │   ├── __init__.py
│   │   ├── base.py               # 工具基类
│   │   ├── time_tool.py          # 时间查询工具
│   │   ├── search_tool.py        # 信息搜索工具
│   │   └── custom_tool.py        # 自定义工具模板
│   ├── utils/                    # 工具函数
│   │   ├── __init__.py
│   │   ├── auth.py               # 认证相关（密码哈希、JWT）
│   │   └── helpers.py            # 辅助函数
│   ├── myagent.db                # SQLite 数据库文件（自动生成）
│   ├── requirements.txt          # Python 依赖
│   ├── .env                      # 环境变量（API key 等）
│   └── README.md                 # 后端文档
│
├── frontend/                     # 前端（从 public/ 复制）
│   ├── index.html                # 访客页面
│   └── static/
│       ├── visitor-chat.js       # 前端 JS（需修改 API 地址）
│       └── style.css
│
├── docs/                         # 文档（保留）
│   ├── LOCAL_BACKEND_PRD.md
│   └── PYTHON_IMPLEMENTATION.md  # 本文档
│
├── tests/                        # 测试（可选）
│   ├── test_api.py
│   └── test_tools.py
│
├── docker-compose.yml            # Docker 配置（可选）
└── README.md                     # 项目总文档
```

### 3.2 文件职责说明

| 文件 | 职责 | 代码量 |
|-----|------|-------|
| **app.py** | Flask 应用入口，注册路由，启动服务 | 50 行 |
| **config.py** | 数据库连接、API key、环境变量 | 30 行 |
| **models.py** | 数据模型（Owner、Session、Message、Token） | 100 行 |
| **routes/session.py** | 会话 CRUD（创建、查询） | 80 行 |
| **routes/message.py** | 消息 CRUD + AI 对话 | 150 行 |
| **routes/owner.py** | 主人登录、信息管理 | 100 行 |
| **services/ai_service.py** | 封装 OpenAI 调用逻辑 | 120 行 |
| **services/tool_service.py** | 工具注册、执行、管理 | 80 行 |
| **tools/time_tool.py** | 时间查询工具实现 | 30 行 |
| **tools/search_tool.py** | 信息搜索工具实现 | 40 行 |

**总代码量**：约 **800 行** Python（比 TypeScript 少 30%）

---

## 4. 数据库设计

### 4.1 表结构（与 TypeScript 版保持一致）

#### 4.1.1 owners 表（主人信息）

```sql
CREATE TABLE owners (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    bio TEXT,
    avatar VARCHAR(500),
    ai_name VARCHAR(100) NOT NULL,
    ai_persona TEXT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**SQLAlchemy 模型**：

```python
class Owner(db.Model):
    __tablename__ = 'owners'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(500))
    ai_name = db.Column(db.String(100), nullable=False)
    ai_persona = db.Column(db.Text)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    sessions = db.relationship('Session', back_populates='owner', cascade='all, delete-orphan')
```

#### 4.1.2 sessions 表（会话信息）

```sql
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    visitor_name VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_sessions_updated ON sessions(updated_at);
```

#### 4.1.3 messages 表（消息记录）

```sql
CREATE TABLE messages (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

#### 4.1.4 tokens 表（登录凭证）

```sql
CREATE TABLE tokens (
    token VARCHAR(100) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

CREATE INDEX idx_tokens_owner ON tokens(owner_id);
CREATE INDEX idx_tokens_expires ON tokens(expires_at);
```

### 4.2 数据库初始化

**自动建表**（使用 SQLAlchemy）：

```python
# backend/app.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///myagent.db'
db = SQLAlchemy(app)

# 导入模型
from models import Owner, Session, Message, Token

# 自动建表
with app.app_context():
    db.create_all()
    print("✅ 数据库表创建成功")
```

**插入测试数据**：

```python
# 创建默认主人
owner = Owner(
    id='jennia',
    name='Jennia',
    bio='专注 AI 应用开发',
    ai_name='Jennia的AI助手',
    ai_persona='你是 Jennia 的 AI 分身，友好、专业',
    email='jennia@example.com',
    password_hash=generate_password_hash('password123')
)
db.session.add(owner)
db.session.commit()
```

---

## 5. API 设计

### 5.1 API 路由映射

| TypeScript 路由 | Python 路由 | 实现文件 |
|----------------|-------------|---------|
| `POST /api/sessions` | `POST /api/sessions` | `routes/session.py` |
| `GET /api/sessions/:id/messages` | `GET /api/sessions/<id>/messages` | `routes/message.py` |
| `POST /api/sessions/:id/chat` | `POST /api/sessions/<id>/chat` | `routes/message.py` |
| `POST /api/owner/login` | `POST /api/owner/login` | `routes/owner.py` |
| `GET /api/owner/sessions` | `GET /api/owner/sessions` | `routes/owner.py` |

### 5.2 核心 API 实现示例

#### 5.2.1 创建会话

**TypeScript 版本**：

```typescript
apiRoutes.post('/sessions', async (c) => {
  const { ownerId, visitorName } = await c.req.json()
  const sessionId = generateId()
  
  const session = {
    id: sessionId,
    owner_id: ownerId,
    visitor_name: visitorName,
    status: 'active',
    created_at: new Date().toISOString()
  }
  
  await c.env.KV.put(kv.sessionKey(sessionId), JSON.stringify(session))
  return c.json({ sessionId })
})
```

**Python 版本**：

```python
# backend/routes/session.py
from flask import Blueprint, request, jsonify
from models import Session, db
from utils.helpers import generate_id

session_bp = Blueprint('session', __name__)

@session_bp.route('/api/sessions', methods=['POST'])
def create_session():
    """创建新会话"""
    data = request.json
    
    # 创建会话
    session = Session(
        id=generate_id(),
        owner_id=data['ownerId'],
        visitor_name=data.get('visitorName'),
        status='active'
    )
    
    db.session.add(session)
    db.session.commit()
    
    return jsonify({'sessionId': session.id}), 201
```

#### 5.2.2 发送消息并调用 AI

**Python 版本**：

```python
# backend/routes/message.py
from flask import Blueprint, request, jsonify
from models import Session, Message, db
from services.ai_service import AIService
from utils.helpers import generate_id

message_bp = Blueprint('message', __name__)
ai_service = AIService()

@message_bp.route('/api/sessions/<session_id>/chat', methods=['POST'])
def chat(session_id):
    """发送消息并获取 AI 回复"""
    data = request.json
    content = data['content']
    
    # 1. 验证会话
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    # 2. 保存访客消息
    visitor_msg = Message(
        id=generate_id(),
        session_id=session_id,
        role='visitor',
        content=content
    )
    db.session.add(visitor_msg)
    db.session.commit()
    
    # 3. 检查主人是否在线
    if session.owner.is_online:
        return jsonify({
            'visitorMessageId': visitor_msg.id,
            'aiReply': None,
            'ownerOnline': True
        })
    
    # 4. 获取历史消息（最近 40 条）
    history = Message.query.filter_by(session_id=session_id)\
        .order_by(Message.created_at.desc())\
        .limit(40)\
        .all()
    history.reverse()
    
    # 5. 调用 AI 服务（包含工具调用）
    ai_content = ai_service.chat(
        owner=session.owner,
        messages=history,
        new_message=content
    )
    
    # 6. 保存 AI 回复
    ai_msg = Message(
        id=generate_id(),
        session_id=session_id,
        role='ai',
        content=ai_content
    )
    db.session.add(ai_msg)
    db.session.commit()
    
    return jsonify({
        'visitorMessageId': visitor_msg.id,
        'aiReply': {'id': ai_msg.id, 'content': ai_content},
        'ownerOnline': False
    })
```

---

## 6. AI 服务实现（含工具调用）

### 6.1 AI 服务类

```python
# backend/services/ai_service.py
import requests
import json
from config import Config
from services.tool_service import ToolService

class AIService:
    def __init__(self):
        self.api_key = Config.OPENAI_API_KEY
        self.base_url = Config.OPENAI_BASE_URL
        self.tool_service = ToolService()
    
    def chat(self, owner, messages, new_message):
        """
        处理对话，支持工具调用
        
        Args:
            owner: Owner 对象
            messages: 历史消息列表
            new_message: 新消息内容
        
        Returns:
            str: AI 回复内容
        """
        # 构建 OpenAI 消息格式
        openai_messages = self._build_messages(owner, messages, new_message)
        
        # 获取所有可用工具
        tools = self.tool_service.get_all_tools()
        
        # 第一次调用 OpenAI
        response = self._call_openai(openai_messages, tools)
        
        # 检查是否需要调用工具
        if 'tool_calls' in response:
            tool_messages = []
            
            # 执行所有工具调用
            for tool_call in response['tool_calls']:
                tool_name = tool_call['function']['name']
                tool_args = json.loads(tool_call['function']['arguments'])
                
                # 执行工具
                tool_result = self.tool_service.execute_tool(
                    tool_name, 
                    tool_args, 
                    owner
                )
                
                tool_messages.append({
                    'role': 'tool',
                    'tool_call_id': tool_call['id'],
                    'name': tool_name,
                    'content': tool_result
                })
            
            # 第二次调用 OpenAI（附带工具结果）
            final_messages = openai_messages + [
                {
                    'role': 'assistant',
                    'content': response.get('content'),
                    'tool_calls': response['tool_calls']
                }
            ] + tool_messages
            
            final_response = self._call_openai(final_messages, tools=None)
            return final_response.get('content', '抱歉，我遇到了一些问题')
        
        # 无需工具调用，直接返回
        return response.get('content', '你好！有什么可以帮你的吗？')
    
    def _build_messages(self, owner, history, new_message):
        """构建 OpenAI 消息格式"""
        messages = [
            {
                'role': 'system',
                'content': owner.ai_persona or f'你是 {owner.name} 的 AI 分身'
            }
        ]
        
        # 添加历史消息
        for msg in history:
            messages.append({
                'role': 'user' if msg.role == 'visitor' else 'assistant',
                'content': msg.content
            })
        
        # 添加新消息
        messages.append({
            'role': 'user',
            'content': new_message
        })
        
        return messages
    
    def _call_openai(self, messages, tools=None):
        """调用 OpenAI API"""
        url = f"{self.base_url}/v1/chat/completions"
        
        payload = {
            'model': 'MiniMax-M2.5',
            'messages': messages,
            'max_tokens': 1500,
            'temperature': 0.7
        }
        
        if tools:
            payload['tools'] = tools
            payload['tool_choice'] = 'auto'
        
        response = requests.post(
            url,
            headers={'Authorization': f'Bearer {self.api_key}'},
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            message = data['choices'][0]['message']
            
            # 返回统一格式
            result = {'content': message.get('content')}
            if message.get('tool_calls'):
                result['tool_calls'] = message['tool_calls']
            
            return result
        else:
            print(f"OpenAI API Error: {response.status_code} {response.text}")
            return {'content': '抱歉，AI 服务暂时不可用'}
```

### 6.2 工具服务类

```python
# backend/services/tool_service.py
import importlib
import os
from pathlib import Path

class ToolService:
    def __init__(self):
        self.tools = {}
        self._load_tools()
    
    def _load_tools(self):
        """自动加载 tools/ 目录下的所有工具"""
        tools_dir = Path(__file__).parent.parent / 'tools'
        
        for file in tools_dir.glob('*_tool.py'):
            module_name = file.stem  # 如 'time_tool'
            module = importlib.import_module(f'tools.{module_name}')
            
            # 获取工具类（约定：类名为 XxxTool）
            tool_class_name = ''.join(word.capitalize() for word in module_name.split('_'))
            tool_class = getattr(module, tool_class_name)
            
            # 实例化工具
            tool_instance = tool_class()
            self.tools[tool_instance.name] = tool_instance
            
            print(f"✅ 加载工具: {tool_instance.name}")
    
    def get_all_tools(self):
        """获取所有工具的定义（OpenAI 格式）"""
        return [tool.to_openai_format() for tool in self.tools.values()]
    
    def execute_tool(self, tool_name, args, owner):
        """执行指定工具"""
        if tool_name not in self.tools:
            return json.dumps({'error': f'Unknown tool: {tool_name}'})
        
        tool = self.tools[tool_name]
        return tool.execute(args, owner)
```

---

## 7. 工具系统设计

### 7.1 工具基类

```python
# backend/tools/base.py
import json
from abc import ABC, abstractmethod

class BaseTool(ABC):
    """工具基类，所有工具必须继承此类"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """工具名称（必须实现）"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """工具描述（必须实现）"""
        pass
    
    @property
    @abstractmethod
    def parameters(self) -> dict:
        """工具参数（JSON Schema 格式，必须实现）"""
        pass
    
    @abstractmethod
    def execute(self, args: dict, owner) -> str:
        """
        执行工具（必须实现）
        
        Args:
            args: 工具参数
            owner: Owner 对象
        
        Returns:
            str: JSON 字符串格式的结果
        """
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

### 7.2 时间查询工具

```python
# backend/tools/time_tool.py
import json
from datetime import datetime
from tools.base import BaseTool

class TimeTool(BaseTool):
    @property
    def name(self):
        return 'get_current_time'
    
    @property
    def description(self):
        return '获取当前时间（北京时间）'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {},
            'required': []
        }
    
    def execute(self, args, owner):
        """执行时间查询"""
        now = datetime.now()
        
        return json.dumps({
            'time': now.strftime('%Y-%m-%d %H:%M:%S'),
            'timezone': 'Asia/Shanghai',
            'timestamp': int(now.timestamp())
        }, ensure_ascii=False)
```

### 7.3 信息搜索工具

```python
# backend/tools/search_tool.py
import json
from tools.base import BaseTool

class SearchTool(BaseTool):
    @property
    def name(self):
        return 'search_owner_info'
    
    @property
    def description(self):
        return '搜索主人的专业技能、项目经验或服务信息'
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'keyword': {
                    'type': 'string',
                    'description': '搜索关键词，如 "RAG"、"workflow"、"AI应用"'
                }
            },
            'required': ['keyword']
        }
    
    def execute(self, args, owner):
        """执行信息搜索"""
        keyword = args.get('keyword', '').lower()
        
        # 模拟项目数据库（后续可改为真实数据库查询）
        mock_projects = [
            {
                'name': '客服知识库系统',
                'type': 'RAG',
                'year': 2024,
                'tech': ['Dify', 'Cloudflare D1'],
                'description': '基于 RAG 的智能客服系统'
            },
            {
                'name': '审批自动化流程',
                'type': 'workflow',
                'year': 2024,
                'tech': ['n8n', 'API集成'],
                'description': '企业流程自动化方案'
            },
            {
                'name': 'AI原生应用开发',
                'type': 'ai_native',
                'year': 2024,
                'tech': ['Hono', 'OpenAI'],
                'description': 'AI Agent 开发框架'
            }
        ]
        
        # 过滤项目
        filtered = [
            p for p in mock_projects
            if keyword in p['name'].lower() or keyword in p['type'].lower()
        ]
        
        return json.dumps({
            'owner_name': owner.name,
            'keyword': args.get('keyword'),
            'projects': filtered,
            'total': len(filtered),
            'bio': owner.bio
        }, ensure_ascii=False)
```

### 7.4 自定义工具模板

```python
# backend/tools/custom_tool.py
import json
from tools.base import BaseTool

class CustomTool(BaseTool):
    """自定义工具模板 - 复制此文件并修改"""
    
    @property
    def name(self):
        return 'your_tool_name'  # 修改工具名称
    
    @property
    def description(self):
        return '你的工具描述'  # 修改工具描述
    
    @property
    def parameters(self):
        return {
            'type': 'object',
            'properties': {
                'param1': {
                    'type': 'string',
                    'description': '参数1的描述'
                },
                'param2': {
                    'type': 'number',
                    'description': '参数2的描述'
                }
            },
            'required': ['param1']  # 必填参数
        }
    
    def execute(self, args, owner):
        """
        执行工具逻辑
        
        Args:
            args: {'param1': 'value', 'param2': 123}
            owner: Owner 对象（可访问 owner.name、owner.bio 等）
        
        Returns:
            JSON 字符串
        """
        try:
            # 1. 获取参数
            param1 = args.get('param1')
            param2 = args.get('param2', 0)
            
            # 2. 执行业务逻辑
            result = f"处理结果: {param1} + {param2}"
            
            # 3. 返回 JSON 字符串
            return json.dumps({
                'success': True,
                'result': result
            }, ensure_ascii=False)
        
        except Exception as e:
            return json.dumps({
                'error': True,
                'message': str(e)
            }, ensure_ascii=False)
```

**添加新工具的步骤**：
1. 复制 `custom_tool.py` 为 `xxx_tool.py`
2. 修改类名为 `XxxTool`
3. 实现 `name`、`description`、`parameters`、`execute`
4. 重启服务，工具自动加载 ✅

---

## 8. 配置文件

### 8.1 环境变量配置

```python
# backend/config.py
import os
from dotenv import load_dotenv

load_dotenv()  # 加载 .env 文件

class Config:
    """配置类"""
    
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'sqlite:///myagent.db'  # 默认 SQLite
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # OpenAI 配置
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://llm.mcisaas.com')
    
    # Flask 配置
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    DEBUG = os.getenv('DEBUG', 'True') == 'True'
    
    # CORS 配置
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
```

### 8.2 .env 文件

```bash
# backend/.env

# OpenAI 配置
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://llm.mcisaas.com

# 数据库配置（SQLite 无需配置，MySQL 示例）
# DATABASE_URL=mysql://root:password@localhost:3306/myagent

# Flask 配置
SECRET_KEY=your-secret-key
DEBUG=True

# CORS 配置（允许前端跨域）
CORS_ORIGINS=http://localhost:8080
```

---

## 9. 主应用入口

```python
# backend/app.py
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

# 创建 Flask 应用
app = Flask(__name__)
app.config.from_object(Config)

# 启用 CORS
CORS(app, origins=Config.CORS_ORIGINS)

# 初始化数据库
db = SQLAlchemy(app)

# 导入模型（必须在 db 初始化之后）
from models import Owner, Session, Message, Token

# 导入路由
from routes.session import session_bp
from routes.message import message_bp
from routes.owner import owner_bp

# 注册蓝图
app.register_blueprint(session_bp)
app.register_blueprint(message_bp)
app.register_blueprint(owner_bp)

# 健康检查
@app.route('/api/ping', methods=['GET'])
def ping():
    return {'status': 'ok', 'message': 'Python backend is running'}

# 初始化数据库
def init_db():
    """初始化数据库（创建表 + 插入测试数据）"""
    with app.app_context():
        db.create_all()
        print("✅ 数据库表创建成功")
        
        # 检查是否有默认主人
        if not Owner.query.get('jennia'):
            from werkzeug.security.password import generate_password_hash
            owner = Owner(
                id='jennia',
                name='Jennia',
                bio='专注 AI 应用开发',
                ai_name='Jennia的AI助手',
                ai_persona='你是 Jennia 的 AI 分身，友好、专业地回答问题',
                email='jennia@example.com',
                password_hash=generate_password_hash('password123')
            )
            db.session.add(owner)
            db.session.commit()
            print("✅ 默认主人创建成功（ID: jennia, 密码: password123）")

if __name__ == '__main__':
    init_db()
    print("🚀 启动 Flask 服务器...")
    print(f"📍 访问地址: http://localhost:5000")
    print(f"📍 API 测试: http://localhost:5000/api/ping")
    app.run(host='0.0.0.0', port=5000, debug=True)
```

---

## 10. 依赖安装

### 10.1 requirements.txt

```txt
# backend/requirements.txt

# Flask 核心
Flask==3.0.0
flask-cors==4.0.0
flask-sqlalchemy==3.1.1

# 数据库
SQLAlchemy==2.0.23

# 密码哈希
werkzeug==3.0.1

# HTTP 请求
requests==2.31.0

# 环境变量
python-dotenv==1.0.0

# 工具库
python-dateutil==2.8.2

# 开发工具（可选）
# pytest==7.4.3
# black==23.12.1
```

### 10.2 安装命令

```bash
# 方案 1：直接安装（推荐）
cd backend
pip install -r requirements.txt

# 方案 2：虚拟环境（隔离依赖）
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## 11. 启动流程

### 11.1 快速启动（3 步）

```bash
# 步骤 1：克隆项目并创建 backend 目录
cd my-agent-python
mkdir backend

# 步骤 2：创建 .env 文件
cat > backend/.env << EOF
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://llm.mcisaas.com
DEBUG=True
EOF

# 步骤 3：启动后端
cd backend
pip install -r requirements.txt
python app.py
```

**输出**：
```
✅ 数据库表创建成功
✅ 默认主人创建成功（ID: jennia, 密码: password123）
🚀 启动 Flask 服务器...
📍 访问地址: http://localhost:5000
📍 API 测试: http://localhost:5000/api/ping
 * Running on http://0.0.0.0:5000
```

### 11.2 测试后端 API

```bash
# 测试健康检查
curl http://localhost:5000/api/ping
# 输出: {"status":"ok","message":"Python backend is running"}

# 创建会话
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia", "visitorName": "测试用户"}'
# 输出: {"sessionId":"xxx"}

# 发送消息
SESSION_ID="xxx"  # 替换为上面返回的 sessionId
curl -X POST "http://localhost:5000/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}'
# 输出: {"aiReply":{"content":"现在是..."},...}
```

### 11.3 前端对接

**修改前端 API 地址**：

```javascript
// frontend/static/visitor-chat.js

// 修改前：
const API_BASE = 'https://my-agent-ao2.pages.dev/api'

// 修改后：
const API_BASE = 'http://localhost:5000/api'
```

**启动前端**：

```bash
# 方案 1：使用 Python 简单服务器
cd frontend
python -m http.server 8080

# 方案 2：使用 Node.js serve
npm install -g serve
serve frontend -p 8080
```

**访问**：
```
前端: http://localhost:8080
后端: http://localhost:5000
```

---

## 12. 数据库切换方案

### 12.1 SQLite → MySQL 切换

**步骤 1：安装 MySQL 驱动**

```bash
pip install pymysql
```

**步骤 2：修改 .env**

```bash
# backend/.env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/myagent
```

**步骤 3：创建数据库**

```bash
mysql -u root -p
CREATE DATABASE myagent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**步骤 4：重启服务**

```bash
python app.py  # 自动建表
```

### 12.2 SQLite → PostgreSQL 切换

```bash
pip install psycopg2-binary

# .env
DATABASE_URL=postgresql://user:password@localhost:5432/myagent
```

---

## 13. Docker 部署方案（可选）

### 13.1 Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY . .

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["python", "app.py"]
```

### 13.2 docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    volumes:
      - ./backend:/app
      - ./backend/myagent.db:/app/myagent.db
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_BASE_URL=https://llm.mcisaas.com
      - DEBUG=True
  
  frontend:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
    depends_on:
      - backend
```

**启动命令**：

```bash
docker-compose up -d
```

---

## 14. 开发计划

### 14.1 第一阶段：基础搭建（1-2 天）

- [x] 创建项目目录结构
- [ ] 安装 Python 依赖
- [ ] 实现数据模型（models.py）
- [ ] 实现配置文件（config.py）
- [ ] 实现主应用（app.py）
- [ ] 测试数据库建表

### 14.2 第二阶段：核心 API（2-3 天）

- [ ] 实现会话管理 API（session.py）
- [ ] 实现消息管理 API（message.py）
- [ ] 实现主人管理 API（owner.py）
- [ ] 实现 AI 服务（ai_service.py）
- [ ] 测试 API 接口

### 14.3 第三阶段：工具系统（2-3 天）

- [ ] 实现工具基类（base.py）
- [ ] 实现工具服务（tool_service.py）
- [ ] 实现时间工具（time_tool.py）
- [ ] 实现搜索工具（search_tool.py）
- [ ] 测试工具调用

### 14.4 第四阶段：前端对接（1-2 天）

- [ ] 修改前端 API 地址
- [ ] 测试前后端联调
- [ ] 处理跨域问题
- [ ] 优化错误处理

### 14.5 第五阶段：测试与优化（1-2 天）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 文档完善

**总计**：**7-12 天**

---

## 15. 常见问题

### Q1: Python 不熟悉怎么办？

**A**: 
- Flask 非常简单，参考本文档的代码示例即可
- 使用 AI 辅助工具（ChatGPT、Cursor、GitHub Copilot）
- 参考 Flask 官方文档：https://flask.palletsprojects.com/

### Q2: 不想用 SQLite，直接用 MySQL 可以吗？

**A**: 
- 可以，但需要先安装 MySQL
- 建议先用 SQLite 跑通流程，再切换 MySQL
- 切换只需修改 `.env` 的 `DATABASE_URL`

### Q3: 如何添加新工具？

**A**: 
1. 复制 `tools/custom_tool.py`
2. 修改 `name`、`description`、`parameters`、`execute`
3. 重启服务（自动加载）

### Q4: 如何部署到服务器？

**A**: 
- 本地开发：`python app.py`
- VPS 部署：使用 Supervisor 或 PM2
- Docker 部署：`docker-compose up -d`

### Q5: 前端如何对接？

**A**: 
- 修改 `frontend/static/visitor-chat.js` 的 `API_BASE`
- 启动前端：`python -m http.server 8080`
- 访问 `http://localhost:8080`

---

## 16. 下一步行动

### 16.1 立即开始

```bash
# 1. 创建 backend 目录
mkdir -p backend/{routes,services,tools,utils}
cd backend

# 2. 创建 requirements.txt
cat > requirements.txt << EOF
Flask==3.0.0
flask-cors==4.0.0
flask-sqlalchemy==3.1.1
SQLAlchemy==2.0.23
werkzeug==3.0.1
requests==2.31.0
python-dotenv==1.0.0
EOF

# 3. 安装依赖
pip install -r requirements.txt

# 4. 创建 .env
cat > .env << EOF
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://llm.mcisaas.com
DEBUG=True
EOF

# 5. 创建 config.py（复制本文档的代码）
# 6. 创建 models.py（复制本文档的代码）
# 7. 创建 app.py（复制本文档的代码）

# 8. 启动服务
python app.py
```

### 16.2 代码获取

**选项 1：手动创建**（参考本文档代码）

**选项 2：让我生成完整代码**（告诉我需要）

---

## 17. 总结

### 17.1 核心要点

1. **技术栈**：Flask + SQLite + SQLAlchemy
2. **数据库**：SQLite（本地），后续可切换 MySQL
3. **工具系统**：基于类的设计，自动加载
4. **代码量**：约 800 行 Python（比 TypeScript 少 30%）
5. **开发周期**：7-12 天
6. **成本**：本地开发免费

### 17.2 优势

- ✅ Python 生态丰富，适合 Agent 开发
- ✅ SQLite 零配置，快速上手
- ✅ 模块化设计，易于扩展
- ✅ 工具自动加载，无需手动注册
- ✅ 完整文档和代码示例

### 17.3 适用场景

- ✅ 本地开发测试
- ✅ Agent 功能快速原型
- ✅ 多样化工具集成
- ✅ 复杂业务逻辑

---

**文档结束**

**准备好开始了吗？告诉我您需要什么帮助！** 😊

可选下一步：
1. 我生成完整的代码文件（app.py、models.py、routes/、tools/ 等）
2. 我创建详细的开发指南（逐步操作）
3. 我提供具体某个模块的实现细节
