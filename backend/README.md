# my-agent Python 后端

基于 **Flask + SQLite + OpenAI Function Calling** 的个人 AI 助手平台 Python 后端实现。

## 🎯 核心功能

- ✅ **OpenAI Function Calling**: 支持工具调用（时间查询、信息搜索）
- ✅ **工具自动加载**: 添加新工具只需放入 `tools/` 目录
- ✅ **SQLite 数据库**: 零配置，易于迁移到 MySQL/PostgreSQL
- ✅ **会话管理**: 访客对话、消息历史、状态管理
- ✅ **人工接管**: 主人可查看会话并回复访客
- ✅ **RESTful API**: 完整的 API 端点支持

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 OpenAI API Key
```

### 3. 启动服务

```bash
python app.py
```

服务器将在 `http://localhost:5000` 启动。

### 4. 访问应用

- **访客页面**: http://localhost:5000/u/jennia
- **主人登录**: http://localhost:5000/owner/login
- **API 测试**: http://localhost:5000/api/ping

## 📁 项目结构

```
backend/
├── app.py                    # Flask 主应用入口
├── config.py                 # 配置文件
├── models.py                 # 数据模型（SQLAlchemy）
├── requirements.txt          # Python 依赖
├── .env.example              # 环境变量示例
├── myagent.db                # SQLite 数据库（自动生成）
├── routes/                   # API 路由
│   ├── __init__.py
│   ├── session.py            # 会话管理 API
│   ├── message.py            # 消息管理 API
│   └── owner.py              # 主人管理 API
├── services/                 # 业务逻辑
│   ├── __init__.py
│   ├── ai_service.py         # AI 调用服务
│   └── tool_service.py       # 工具管理服务
├── tools/                    # 工具实现
│   ├── __init__.py
│   ├── base.py               # 工具基类
│   ├── time_tool.py          # 时间查询工具
│   └── search_tool.py        # 信息搜索工具
└── utils/                    # 工具函数
    ├── __init__.py
    └── helpers.py            # 辅助函数
```

## 🔧 API 端点

### 访客端 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/profile/<owner_id>` | GET | 获取主人公开信息 |
| `/api/sessions` | POST | 创建会话 |
| `/api/sessions/<id>/messages` | GET | 获取消息 |
| `/api/sessions/<id>/chat` | POST | 发送消息并获取 AI 回复 |

### 主人端 API

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/owner/register` | POST | 注册主人（开发用） |
| `/api/owner/login` | POST | 主人登录 |
| `/api/owner/logout` | POST | 主人登出 |
| `/api/owner/verify` | GET | 验证登录状态 |
| `/api/owner/profile` | GET/PUT | 获取/更新主人信息 |
| `/api/owner/sessions` | GET | 获取会话列表 |
| `/api/owner/sessions/<id>/reply` | POST | 主人回复 |
| `/api/owner/heartbeat` | POST | 更新在线状态 |

## 🛠️ 如何添加新工具

### 1. 创建工具文件

在 `tools/` 目录下创建新文件，如 `weather_tool.py`:

```python
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
        # 这里调用天气 API
        return json.dumps({
            'city': city,
            'temperature': 25,
            'weather': '晴天'
        }, ensure_ascii=False)
```

### 2. 重启服务

工具会自动加载，无需修改其他代码。

## 💾 数据库

### SQLite（默认）

- **位置**: `backend/myagent.db`
- **自动创建**: 首次启动时自动建表
- **测试账号**: 
  - ID: `jennia`
  - 邮箱: `jennia@example.com`
  - 密码: `password123`

### 切换到 MySQL

1. 安装驱动：
```bash
pip install pymysql
```

2. 修改 `.env`:
```env
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/myagent
```

3. 创建数据库：
```sql
CREATE DATABASE myagent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

4. 重启服务（自动建表）

## 🧪 测试

### 测试健康检查
```bash
curl http://localhost:5000/api/ping
```

### 测试 AI 连接
```bash
curl -X POST http://localhost:5000/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}'
```

### 创建会话并发送消息
```bash
# 创建会话
SESSION_ID=$(curl -s -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}' | jq -r '.sessionId')

# 发送消息
curl -X POST "http://localhost:5000/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}'
```

## 📖 文档

- **完整 PRD**: [docs/PROJECT_PRD.md](../docs/PROJECT_PRD.md)
- **Python 实现**: [docs/PYTHON_IMPLEMENTATION.md](../docs/PYTHON_IMPLEMENTATION.md)
- **工具调用原理**: [docs/function-calling-explained.md](../docs/function-calling-explained.md)
- **快速参考**: [docs/QUICK_REFERENCE.md](../docs/QUICK_REFERENCE.md)

## 🐛 常见问题

### Q: 如何修改 AI 人格？

A: 编辑主人信息中的 `ai_persona` 字段，或在初始化时修改 `app.py` 中的默认值。

### Q: 工具调用不生效？

A: 
1. 检查 `.env` 中的 `OPENAI_API_KEY` 是否正确
2. 确认 API 端点支持 Function Calling（MiniMax-M2.5 支持）
3. 查看控制台日志中的 `[AI]` 标记

### Q: 如何部署到服务器？

A: 
- **本地开发**: `python app.py`
- **生产环境**: 使用 Gunicorn + Nginx
  ```bash
  pip install gunicorn
  gunicorn -w 4 -b 0.0.0.0:5000 app:app
  ```

## 📄 许可证

MIT License

## 👨‍💻 作者

- **Jennia** - AI 应用开发工程师
- **GitHub**: https://github.com/Jenniahu/my-agent
