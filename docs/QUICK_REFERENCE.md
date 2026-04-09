# Python 后端开发快速参考

## 📚 文档导航

| 文档 | 内容 | 适用场景 |
|-----|------|---------|
| **PYTHON_IMPLEMENTATION.md** | 完整技术设计文档（30KB） | 开发前必读 |
| **LOCAL_BACKEND_PRD.md** | 本地后端改造 PRD（22KB） | 了解背景和方案对比 |
| 本文档 | 快速参考和代码片段 | 开发时查阅 |

---

## 🚀 10 分钟快速启动

### 步骤 1：创建项目结构

```bash
mkdir -p my-agent-python/backend/{routes,services,tools,utils}
cd my-agent-python/backend
```

### 步骤 2：创建依赖文件

```bash
cat > requirements.txt << 'EOF'
Flask==3.0.0
flask-cors==4.0.0
flask-sqlalchemy==3.1.1
SQLAlchemy==2.0.23
werkzeug==3.0.1
requests==2.31.0
python-dotenv==1.0.0
EOF
```

### 步骤 3：安装依赖

```bash
pip install -r requirements.txt
```

### 步骤 4：创建环境变量

```bash
cat > .env << 'EOF'
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://llm.mcisaas.com
DEBUG=True
CORS_ORIGINS=http://localhost:8080
EOF
```

### 步骤 5：获取完整代码

**现在告诉我："生成完整代码"，我会为您创建所有文件！**

---

## 📁 项目结构一览

```
backend/
├── app.py                    # 主应用（50 行）
├── config.py                 # 配置文件（30 行）
├── models.py                 # 数据模型（100 行）
├── routes/
│   ├── session.py            # 会话 API（80 行）
│   ├── message.py            # 消息 API（150 行）
│   └── owner.py              # 主人 API（100 行）
├── services/
│   ├── ai_service.py         # AI 服务（120 行）
│   └── tool_service.py       # 工具服务（80 行）
├── tools/
│   ├── base.py               # 工具基类（40 行）
│   ├── time_tool.py          # 时间工具（30 行）
│   ├── search_tool.py        # 搜索工具（40 行）
│   └── custom_tool.py        # 自定义模板（50 行）
├── utils/
│   ├── auth.py               # 认证工具（40 行）
│   └── helpers.py            # 辅助函数（30 行）
├── requirements.txt          # 依赖列表
├── .env                      # 环境变量
└── myagent.db               # SQLite 数据库（自动生成）
```

**总代码量**：约 800 行 Python

---

## 🔧 核心代码片段

### 1. 主应用入口（app.py）

```python
from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db = SQLAlchemy(app)

# 导入路由
from routes.session import session_bp
from routes.message import message_bp
from routes.owner import owner_bp

app.register_blueprint(session_bp)
app.register_blueprint(message_bp)
app.register_blueprint(owner_bp)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### 2. 数据模型（models.py）

```python
from app import db
from datetime import datetime

class Owner(db.Model):
    __tablename__ = 'owners'
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    ai_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Message(db.Model):
    __tablename__ = 'messages'
    id = db.Column(db.String(50), primary_key=True)
    session_id = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### 3. API 路由（routes/message.py）

```python
from flask import Blueprint, request, jsonify
from models import Message, db
from services.ai_service import AIService

message_bp = Blueprint('message', __name__)
ai_service = AIService()

@message_bp.route('/api/sessions/<session_id>/chat', methods=['POST'])
def chat(session_id):
    content = request.json['content']
    
    # 保存访客消息
    visitor_msg = Message(
        id=generate_id(),
        session_id=session_id,
        role='visitor',
        content=content
    )
    db.session.add(visitor_msg)
    db.session.commit()
    
    # 调用 AI
    ai_content = ai_service.chat(session_id, content)
    
    # 保存 AI 回复
    ai_msg = Message(
        id=generate_id(),
        session_id=session_id,
        role='ai',
        content=ai_content
    )
    db.session.add(ai_msg)
    db.session.commit()
    
    return jsonify({'aiReply': {'content': ai_content}})
```

### 4. 工具基类（tools/base.py）

```python
from abc import ABC, abstractmethod

class BaseTool(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        pass
    
    @abstractmethod
    def execute(self, args: dict, owner) -> str:
        pass
    
    def to_openai_format(self) -> dict:
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.description,
                'parameters': self.parameters
            }
        }
```

### 5. 时间工具（tools/time_tool.py）

```python
import json
from datetime import datetime
from tools.base import BaseTool

class TimeTool(BaseTool):
    @property
    def name(self):
        return 'get_current_time'
    
    @property
    def description(self):
        return '获取当前时间'
    
    @property
    def parameters(self):
        return {'type': 'object', 'properties': {}}
    
    def execute(self, args, owner):
        now = datetime.now()
        return json.dumps({
            'time': now.strftime('%Y-%m-%d %H:%M:%S')
        })
```

---

## 🛠️ 常用命令

### 开发命令

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python app.py

# 测试 API
curl http://localhost:5000/api/ping

# 查看数据库
sqlite3 myagent.db "SELECT * FROM owners;"
```

### Git 命令

```bash
# 初始化仓库
git init
git add .
git commit -m "Initial Python backend"

# 推送到 GitHub
git remote add origin https://github.com/yourusername/my-agent-python.git
git push -u origin main
```

---

## 🔍 调试技巧

### 1. 打印调试

```python
print(f"[DEBUG] 变量值: {variable}")
```

### 2. 查看数据库

```bash
sqlite3 myagent.db
.tables
.schema owners
SELECT * FROM messages LIMIT 10;
```

### 3. 测试 API

```bash
# 创建会话
curl -X POST http://localhost:5000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}'

# 发送消息
curl -X POST http://localhost:5000/api/sessions/xxx/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "你好"}'
```

---

## ❓ 常见问题速查

### Q: 如何添加新工具？

```bash
# 1. 复制模板
cp tools/custom_tool.py tools/weather_tool.py

# 2. 修改类名和逻辑
class WeatherTool(BaseTool):
    @property
    def name(self):
        return 'get_weather'
    
    def execute(self, args, owner):
        # 你的逻辑
        return json.dumps({'result': 'sunny'})

# 3. 重启服务（自动加载）
python app.py
```

### Q: 如何切换数据库？

```bash
# SQLite → MySQL
pip install pymysql
# 修改 .env
DATABASE_URL=mysql+pymysql://root:password@localhost/myagent
```

### Q: 如何部署到服务器？

```bash
# 安装 Supervisor
sudo apt install supervisor

# 创建配置
sudo nano /etc/supervisor/conf.d/myagent.conf

[program:myagent]
command=/path/to/python /path/to/app.py
directory=/path/to/backend
autostart=true
autorestart=true

# 启动
sudo supervisorctl reread
sudo supervisorctl update
```

---

## 📚 参考资源

- **Flask 官方文档**: https://flask.palletsprojects.com/
- **SQLAlchemy 文档**: https://docs.sqlalchemy.org/
- **OpenAI API 文档**: https://platform.openai.com/docs/
- **本项目文档**: `docs/PYTHON_IMPLEMENTATION.md`

---

## 🎯 下一步

**选择您需要的帮助**：

1. ✅ **生成完整代码**（所有文件一次性创建）
2. ✅ **逐步指导**（手把手教学）
3. ✅ **特定功能实现**（如文件上传、定时任务）
4. ✅ **部署指南**（Docker/VPS）

**告诉我："生成完整代码"，我会立即创建所有文件！** 🚀
