# 本地后端改造 PRD 文档

## 📋 产品需求文档（PRD）

**文档版本**: v1.0  
**创建日期**: 2026-04-09  
**作者**: Jennia  
**项目名称**: my-agent 本地后端改造方案

---

## 1. 背景与现状

### 1.1 当前架构

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Pages                       │
│  (边缘计算平台，全球部署，无服务器架构)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  前端（访客页面）                                        │
│  ├── HTML/CSS/JavaScript                                │
│  └── public/static/visitor-chat.js                      │
│                                                          │
│  后端（Hono 框架，TypeScript）                           │
│  ├── src/routes/api.ts      ← 🔴 所有后端逻辑都在这里   │
│  ├── src/routes/visitor.ts                              │
│  └── src/routes/owner.ts                                │
│                                                          │
│  数据存储（Cloudflare KV）                               │
│  └── 键值对存储（Key-Value Store）                      │
│      ├── owner:{id} → Owner 对象                         │
│      ├── session:{id} → Session 对象                     │
│      ├── msgs:{session_id} → Message[] 数组             │
│      └── token:{token} → ownerId                         │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 1.2 "后端在哪里？"

**回答**：

当前项目的"后端"是 **`src/routes/api.ts`** 文件，但它**不是传统意义的后端服务器**。

- **运行位置**：Cloudflare Workers（边缘计算节点，全球分布）
- **编程语言**：TypeScript（会被编译成 JavaScript）
- **框架**：Hono（轻量级 Web 框架，类似 Express）
- **运行环境**：V8 JavaScript 引擎（不是 Node.js！）

**关键点**：
- ✅ 有后端逻辑（API 路由、工具调用、数据库操作）
- ✅ 使用 TypeScript 编写
- ❌ **不是**独立的服务器进程
- ❌ **不是** Node.js 环境（无法使用 `fs`、`path` 等模块）
- ❌ **不能**直接本地运行（需要 Cloudflare Workers 环境）

### 1.3 数据存储

**当前使用**：Cloudflare KV（键值对存储）

**特点**：
- ✅ 非常简单（就像 Redis，只有 `get`、`put`、`delete`）
- ✅ 全球分布（低延迟）
- ✅ 无服务器（不需要维护数据库）
- ❌ 无法复杂查询（不支持 SQL）
- ❌ 数据结构单一（只能存 JSON 字符串）
- ❌ 无法关联查询（无外键、JOIN）

**数据示例**：

```javascript
// KV 存储结构
{
  "owner:jennia": "{\"id\":\"jennia\",\"name\":\"Jennia\",\"bio\":\"...\"}",
  "session:abc123": "{\"id\":\"abc123\",\"owner_id\":\"jennia\",\"status\":\"active\"}",
  "msgs:abc123": "[{\"id\":\"msg1\",\"role\":\"visitor\",\"content\":\"你好\"}]",
  "token:xyz789": "jennia"
}
```

---

## 2. 需求分析

### 2.1 改造目标

将当前的 **Cloudflare Pages + KV** 架构改造为 **本地后端 + 传统数据库** 架构。

### 2.2 核心需求

| 需求 | 当前实现 | 期望实现 |
|-----|---------|---------|
| **后端语言** | TypeScript（Cloudflare Workers） | Python/Node.js/Java 等传统语言 |
| **后端运行** | Cloudflare 边缘节点 | 本地服务器（自己电脑/VPS） |
| **数据存储** | Cloudflare KV（简单键值对） | MySQL/PostgreSQL/MongoDB 等关系型/文档数据库 |
| **API 调用** | Hono 框架（类似 Express） | Flask/FastAPI/Express/Spring Boot 等 |
| **工具实现** | TypeScript | Python/Node.js/Java |
| **部署方式** | Cloudflare Pages（一键部署） | Docker/PM2/Systemd 等 |

### 2.3 为什么要改造？

**可能的原因**：

1. **语言限制**：不会 TypeScript，更熟悉 Python/Java/PHP
2. **数据库需求**：需要复杂查询、关系型数据、事务支持
3. **功能扩展**：需要文件上传、定时任务、WebSocket 等 Cloudflare 不支持的功能
4. **成本控制**：Cloudflare 免费版有限制（请求数、KV 操作次数）
5. **数据控制**：希望数据存在自己服务器上

---

## 3. 架构对比

### 3.1 当前架构（Cloudflare）

```
┌──────────┐
│ 浏览器   │
└────┬─────┘
     │ HTTP 请求
     ↓
┌─────────────────────────────────────┐
│  Cloudflare Pages (全球边缘节点)     │
├─────────────────────────────────────┤
│  前端: HTML/JS/CSS                   │
│  后端: Hono (TypeScript)             │
│  数据: KV 存储                       │
└─────────────────────────────────────┘
```

**优点**：
- ✅ 全球 CDN，访问速度快
- ✅ 无需运维，自动扩展
- ✅ 免费额度大（10万请求/天）
- ✅ HTTPS 自动配置

**缺点**：
- ❌ 必须用 TypeScript/JavaScript
- ❌ 数据存储简单（只有 KV）
- ❌ 无法运行长时间任务
- ❌ 无法使用 Node.js 特有模块

### 3.2 本地后端架构（改造后）

```
┌──────────┐
│ 浏览器   │
└────┬─────┘
     │ HTTP 请求
     ↓
┌─────────────────────────────────────┐
│  前端静态文件服务器 (Nginx/Caddy)   │
│  或 Cloudflare Pages (仅前端)       │
└────┬────────────────────────────────┘
     │ API 请求
     ↓
┌─────────────────────────────────────┐
│  本地后端服务器                      │
├─────────────────────────────────────┤
│  Python: Flask/FastAPI               │
│  Node.js: Express/Nest.js            │
│  Java: Spring Boot                   │
│  Go: Gin/Echo                        │
└────┬────────────────────────────────┘
     │ 数据库查询
     ↓
┌─────────────────────────────────────┐
│  数据库                              │
├─────────────────────────────────────┤
│  关系型: MySQL/PostgreSQL            │
│  文档型: MongoDB                     │
│  缓存: Redis                         │
└─────────────────────────────────────┘
```

**优点**：
- ✅ 可用任何编程语言（Python/Java/Go/PHP）
- ✅ 完整的数据库支持（MySQL/PostgreSQL）
- ✅ 支持文件上传、定时任务、WebSocket
- ✅ 数据完全可控
- ✅ 可使用各种第三方库

**缺点**：
- ❌ 需要自己运维服务器
- ❌ 需要配置 HTTPS（Let's Encrypt）
- ❌ 需要处理高并发（负载均衡）
- ❌ 服务器成本（VPS 费用）

---

## 4. 改造方案

### 4.1 方案对比

| 方案 | 前端部署 | 后端部署 | 数据库 | 适用场景 |
|-----|---------|---------|--------|---------|
| **方案 A：全本地** | 本地 Nginx | 本地 Python/Node.js | 本地 MySQL | 开发测试、内网使用 |
| **方案 B：混合** | Cloudflare Pages | 本地 Python/Node.js | 本地 MySQL | 前端全球加速，后端本地 |
| **方案 C：VPS** | VPS Nginx | VPS Python/Node.js | VPS MySQL | 生产环境，完全自主 |
| **方案 D：容器化** | Docker Nginx | Docker Python/Node.js | Docker MySQL | 一键部署，易迁移 |

**推荐方案**：**方案 D（Docker 容器化）**

**理由**：
1. 一键启动（`docker-compose up`）
2. 环境隔离（不污染本地环境）
3. 易迁移（本地开发 → VPS 生产）
4. 易扩展（添加 Redis、Nginx 等服务）

### 4.2 技术栈选择

#### 前端（保持不变）

```
HTML + CSS + JavaScript
├── Tailwind CSS (样式)
├── Marked.js (Markdown 渲染)
└── Axios/Fetch (HTTP 请求)
```

#### 后端（选一种）

**Python 方案**（推荐，最简单）：

```
Flask / FastAPI
├── Flask: 轻量级，类似 Express
└── FastAPI: 现代化，自动生成 API 文档，支持 async/await
```

**Node.js 方案**（如果熟悉 JavaScript）：

```
Express / Nest.js
├── Express: 最流行，社区大
└── Nest.js: 类似 Spring Boot，适合大项目
```

**Go 方案**（性能最好）：

```
Gin / Echo
└── 编译型语言，性能接近 C++
```

**Java 方案**（企业级）：

```
Spring Boot
└── 功能最全，适合大型项目
```

#### 数据库

**关系型数据库**（推荐）：

```
MySQL / PostgreSQL
├── MySQL: 最流行，资料多
└── PostgreSQL: 功能强大，支持 JSON
```

**文档数据库**（灵活）：

```
MongoDB
└── 适合非结构化数据，类似 JSON
```

**缓存**（可选）：

```
Redis
└── 用于会话存储、消息队列
```

---

## 5. 数据模型设计

### 5.1 当前 KV 存储（扁平结构）

```typescript
// KV 键值对
owner:jennia → {"id":"jennia","name":"Jennia","bio":"..."}
session:abc123 → {"id":"abc123","owner_id":"jennia"}
msgs:abc123 → [{"id":"msg1","content":"你好"}]
```

### 5.2 关系型数据库（规范化设计）

#### 表结构设计

**1. owners 表（主人信息）**

| 字段 | 类型 | 说明 | 约束 |
|-----|------|------|------|
| id | VARCHAR(50) | 主人唯一标识 | PRIMARY KEY |
| name | VARCHAR(100) | 显示名称 | NOT NULL |
| bio | TEXT | 个人简介 | |
| avatar | VARCHAR(500) | 头像 URL | |
| ai_name | VARCHAR(100) | AI 助手名称 | NOT NULL |
| ai_persona | TEXT | AI 人格设定 | |
| email | VARCHAR(255) | 邮箱 | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | 密码哈希 | NOT NULL |
| created_at | TIMESTAMP | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | DEFAULT NOW() |

**2. sessions 表（会话信息）**

| 字段 | 类型 | 说明 | 约束 |
|-----|------|------|------|
| id | VARCHAR(50) | 会话唯一标识 | PRIMARY KEY |
| owner_id | VARCHAR(50) | 主人 ID | FOREIGN KEY → owners(id) |
| visitor_name | VARCHAR(100) | 访客名称 | |
| status | ENUM | 状态（active/taken_over/closed） | NOT NULL |
| created_at | TIMESTAMP | 创建时间 | DEFAULT NOW() |
| updated_at | TIMESTAMP | 更新时间 | DEFAULT NOW() |

**3. messages 表（消息记录）**

| 字段 | 类型 | 说明 | 约束 |
|-----|------|------|------|
| id | VARCHAR(50) | 消息唯一标识 | PRIMARY KEY |
| session_id | VARCHAR(50) | 会话 ID | FOREIGN KEY → sessions(id) |
| role | ENUM | 角色（visitor/ai/owner） | NOT NULL |
| content | TEXT | 消息内容 | NOT NULL |
| created_at | TIMESTAMP | 创建时间 | DEFAULT NOW() |

**4. tokens 表（登录凭证）**

| 字段 | 类型 | 说明 | 约束 |
|-----|------|------|------|
| token | VARCHAR(100) | 凭证标识 | PRIMARY KEY |
| owner_id | VARCHAR(50) | 主人 ID | FOREIGN KEY → owners(id) |
| expires_at | TIMESTAMP | 过期时间 | NOT NULL |
| created_at | TIMESTAMP | 创建时间 | DEFAULT NOW() |

**5. online_status 表（在线状态）**

| 字段 | 类型 | 说明 | 约束 |
|-----|------|------|------|
| owner_id | VARCHAR(50) | 主人 ID | PRIMARY KEY, FOREIGN KEY → owners(id) |
| is_online | BOOLEAN | 是否在线 | NOT NULL, DEFAULT FALSE |
| last_heartbeat | TIMESTAMP | 最后心跳时间 | DEFAULT NOW() |

#### 索引设计

```sql
-- 提升查询性能
CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_tokens_owner ON tokens(owner_id);
CREATE INDEX idx_tokens_expires ON tokens(expires_at);
```

---

## 6. API 接口映射

### 6.1 当前 API（TypeScript Hono）

```typescript
// src/routes/api.ts
apiRoutes.post('/sessions', ...)                      // 创建会话
apiRoutes.get('/sessions/:id/messages', ...)          // 获取消息
apiRoutes.post('/sessions/:id/chat', ...)             // 发送消息
apiRoutes.post('/owner/login', ...)                   // 主人登录
apiRoutes.get('/owner/sessions', ...)                 // 获取会话列表
```

### 6.2 改造后 API（以 Python Flask 为例）

```python
# app.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/sessions', methods=['POST'])
def create_session():
    # 创建会话逻辑
    return jsonify({'sessionId': '...'})

@app.route('/api/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    # 获取消息逻辑
    return jsonify({'messages': [...]})

@app.route('/api/sessions/<session_id>/chat', methods=['POST'])
def chat(session_id):
    # 发送消息并调用 AI
    return jsonify({'aiReply': {...}})

@app.route('/api/owner/login', methods=['POST'])
def login():
    # 主人登录逻辑
    return jsonify({'token': '...'})
```

---

## 7. 工具调用改造

### 7.1 当前实现（TypeScript）

```typescript
// src/routes/api.ts

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间',
      parameters: { ... }
    }
  }
]

async function executeToolCall(name: string, args: any) {
  switch (name) {
    case 'get_current_time':
      const now = new Date()
      return JSON.stringify({ time: now.toISOString() })
  }
}
```

### 7.2 改造后实现（Python）

```python
# tools.py

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前时间",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]

def execute_tool_call(name: str, args: dict) -> str:
    """执行工具调用"""
    if name == 'get_current_time':
        import datetime
        now = datetime.datetime.now()
        return json.dumps({"time": now.isoformat()})
    
    return json.dumps({"error": "Unknown tool"})
```

**关键点**：

- ✅ 逻辑完全相同
- ✅ Python 代码更简洁（无需类型声明）
- ✅ 可使用 Python 丰富的第三方库（requests、pandas、numpy）

---

## 8. 部署方案

### 8.1 Docker Compose 方案（推荐）

**目录结构**：

```
my-agent-local/
├── frontend/              # 前端（可选，也可继续用 Cloudflare）
│   ├── index.html
│   └── static/
│       └── visitor-chat.js
│
├── backend/               # 后端（Python Flask）
│   ├── app.py             # 主应用
│   ├── models.py          # 数据模型
│   ├── tools.py           # 工具定义
│   ├── requirements.txt   # Python 依赖
│   └── Dockerfile         # 后端镜像
│
├── database/              # 数据库初始化脚本
│   └── init.sql           # 建表 SQL
│
└── docker-compose.yml     # 一键启动配置
```

**docker-compose.yml**：

```yaml
version: '3.8'

services:
  # MySQL 数据库
  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root123
      MYSQL_DATABASE: myagent
    volumes:
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
      - mysql_data:/var/lib/mysql
    ports:
      - "3306:3306"
  
  # Redis 缓存（可选）
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  # Python 后端
  backend:
    build: ./backend
    environment:
      DATABASE_URL: mysql://root:root123@db:3306/myagent
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_BASE_URL: https://llm.mcisaas.com
    ports:
      - "5000:5000"
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app
  
  # Nginx 前端（可选）
  frontend:
    image: nginx:alpine
    volumes:
      - ./frontend:/usr/share/nginx/html
    ports:
      - "8080:80"
    depends_on:
      - backend

volumes:
  mysql_data:
```

**启动命令**：

```bash
# 1. 设置环境变量
export OPENAI_API_KEY=your-api-key

# 2. 一键启动所有服务
docker-compose up -d

# 3. 访问应用
# 前端: http://localhost:8080
# 后端: http://localhost:5000
# 数据库: localhost:3306
```

### 8.2 本地开发方案（不用 Docker）

**安装依赖**：

```bash
# Python 环境
cd backend
pip install flask flask-cors pymysql requests

# 启动 MySQL（本地安装）
mysql -u root -p
CREATE DATABASE myagent;

# 启动后端
python app.py
```

### 8.3 VPS 生产部署

**推荐工具**：

- **反向代理**：Nginx / Caddy（自动 HTTPS）
- **进程管理**：Supervisor / PM2 / Systemd
- **容器编排**：Docker Compose（最简单）

**配置示例（Nginx）**：

```nginx
# /etc/nginx/sites-available/myagent

server {
    listen 80;
    server_name myagent.example.com;
    
    # 前端静态文件
    location / {
        root /var/www/myagent/frontend;
        try_files $uri /index.html;
    }
    
    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 9. 开发计划

### 9.1 第一阶段：环境搭建（1-2 天）

- [ ] 选择后端语言（Python/Node.js/Go/Java）
- [ ] 安装 Docker 和 Docker Compose
- [ ] 创建项目目录结构
- [ ] 配置数据库（MySQL/PostgreSQL）
- [ ] 编写 Dockerfile 和 docker-compose.yml

### 9.2 第二阶段：数据库迁移（2-3 天）

- [ ] 设计数据库表结构（owners、sessions、messages）
- [ ] 编写建表 SQL 脚本
- [ ] 编写数据模型（ORM：SQLAlchemy/Prisma）
- [ ] 实现 CRUD 操作（增删改查）
- [ ] 数据迁移脚本（从 KV 导出数据）

### 9.3 第三阶段：API 实现（3-5 天）

- [ ] 实现会话管理 API（创建、查询）
- [ ] 实现消息 API（发送、接收）
- [ ] 实现主人登录 API（JWT 认证）
- [ ] 实现工具调用逻辑（OpenAI Function Calling）
- [ ] 实现在线状态管理（WebSocket/心跳）

### 9.4 第四阶段：前端对接（1-2 天）

- [ ] 修改前端 API 地址（指向本地后端）
- [ ] 测试所有功能（对话、工具调用、登录）
- [ ] 处理跨域问题（CORS）
- [ ] 优化错误处理

### 9.5 第五阶段：测试与优化（2-3 天）

- [ ] 单元测试（后端 API）
- [ ] 集成测试（前后端联调）
- [ ] 性能测试（并发、响应时间）
- [ ] 安全测试（SQL 注入、XSS）
- [ ] 文档编写

**总计**：**10-15 天**

---

## 10. 成本对比

### 10.1 Cloudflare 方案（当前）

| 项目 | 免费版 | 付费版 |
|-----|-------|-------|
| 请求数 | 10 万/天 | 无限 |
| KV 读取 | 10 万/天 | 1000 万/月 ($0.50/百万) |
| KV 写入 | 1000/天 | 100 万/月 ($5.00/百万) |
| 存储 | 1 GB | 无限 |
| **月成本** | **$0** | **约 $5-20** |

### 10.2 本地方案

| 项目 | 本地开发 | VPS 部署 |
|-----|---------|---------|
| 服务器 | $0（自己电脑） | $5-50/月 |
| 域名 | $0 | $10/年 |
| SSL 证书 | $0（Let's Encrypt） | $0 |
| 数据库 | $0（本地） | 包含在 VPS |
| **月成本** | **$0** | **$5-50** |

### 10.3 结论

- **开发测试**：本地免费
- **小规模生产**：VPS $5-10/月（如 DigitalOcean Droplet）
- **大规模生产**：建议继续用 Cloudflare（全球 CDN，自动扩展）

---

## 11. 风险与挑战

### 11.1 技术风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| **Python 不熟悉** | 开发效率低 | 参考 Flask 官方文档，使用 ChatGPT 辅助 |
| **数据库设计错误** | 性能问题 | 先设计 ER 图，让有经验的人审查 |
| **CORS 跨域问题** | 前端无法调用 API | 后端配置 `flask-cors` |
| **部署复杂** | 运维成本高 | 使用 Docker，一键部署 |

### 11.2 运维风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| **服务器宕机** | 服务中断 | 使用 PM2/Supervisor 自动重启 |
| **数据库丢失** | 数据丢失 | 定期备份（cron + mysqldump） |
| **高并发压力** | 响应变慢 | 使用 Redis 缓存、负载均衡 |
| **安全漏洞** | 数据泄露 | SQL 防注入、XSS 过滤、HTTPS |

---

## 12. 决策建议

### 12.1 如果您的目标是...

#### **"我只是想学习 Python，不在乎性能"**

→ **推荐**：方案 A（全本地开发）
- 使用 Flask + SQLite（最简单）
- 不需要 Docker（减少学习成本）
- 本地开发，无需部署

#### **"我希望做一个可以给朋友用的产品"**

→ **推荐**：方案 D（Docker 容器化）
- Flask/FastAPI + MySQL + Redis
- Docker Compose 一键部署
- 可迁移到 VPS

#### **"我想商业化，需要高性能"**

→ **推荐**：继续用 Cloudflare 或改用 Go/Rust
- Cloudflare 全球 CDN，性能最好
- 或用 Go（Gin 框架）+ PostgreSQL
- 部署到多个区域（AWS/Vercel）

#### **"我只是不想写 TypeScript"**

→ **建议**：尝试使用 **AI 辅助工具**（如 Cursor、GitHub Copilot）
- TypeScript 其实和 JavaScript 类似
- 当前架构已经很好，换语言成本高
- 可以让 AI 帮你写 TypeScript 代码

---

## 13. 下一步行动

### 13.1 明确需求

请回答以下问题：

1. **为什么要改造？**
   - [ ] 不会 TypeScript
   - [ ] 需要复杂数据库查询
   - [ ] 需要文件上传/定时任务
   - [ ] 希望数据存在自己服务器

2. **期望用什么语言？**
   - [ ] Python（Flask/FastAPI）
   - [ ] Node.js（Express）
   - [ ] Java（Spring Boot）
   - [ ] Go（Gin）
   - [ ] 其他：______

3. **是否有 Docker 经验？**
   - [ ] 有，可以用 Docker Compose
   - [ ] 没有，希望用传统方式部署

4. **是否需要部署到生产环境？**
   - [ ] 是，需要给其他人使用
   - [ ] 否，只是本地开发学习

### 13.2 推荐方案

根据您的回答，我会推荐最适合的方案并提供：

1. ✅ 完整的项目结构
2. ✅ 数据库建表 SQL
3. ✅ 后端代码示例（Python/Node.js）
4. ✅ Docker 配置文件
5. ✅ 一键启动脚本

---

## 14. 附录

### 14.1 Python Flask 示例代码

**最小可运行版本**（100 行代码）：

```python
# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import requests
import json
from datetime import datetime

app = Flask(__name__)
CORS(app)  # 允许跨域

# 数据库连接
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="root123",
    database="myagent"
)

# OpenAI 配置
OPENAI_API_KEY = "your-api-key"
OPENAI_BASE_URL = "https://llm.mcisaas.com/v1/chat/completions"

# 工具定义
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_time",
            "description": "获取当前时间",
            "parameters": {"type": "object", "properties": {}}
        }
    }
]

def execute_tool(name, args):
    """执行工具"""
    if name == 'get_current_time':
        now = datetime.now()
        return json.dumps({"time": now.isoformat()})
    return json.dumps({"error": "Unknown tool"})

@app.route('/api/sessions', methods=['POST'])
def create_session():
    """创建会话"""
    data = request.json
    cursor = db.cursor()
    session_id = f"session_{datetime.now().timestamp()}"
    
    cursor.execute(
        "INSERT INTO sessions (id, owner_id, visitor_name, status) VALUES (%s, %s, %s, %s)",
        (session_id, data['ownerId'], data.get('visitorName'), 'active')
    )
    db.commit()
    
    return jsonify({"sessionId": session_id})

@app.route('/api/sessions/<session_id>/chat', methods=['POST'])
def chat(session_id):
    """发送消息并调用 AI"""
    data = request.json
    content = data['content']
    
    # 1. 保存访客消息
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO messages (id, session_id, role, content) VALUES (%s, %s, %s, %s)",
        (f"msg_{datetime.now().timestamp()}", session_id, 'visitor', content)
    )
    db.commit()
    
    # 2. 调用 OpenAI
    response = requests.post(
        OPENAI_BASE_URL,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
        json={
            "model": "MiniMax-M2.5",
            "messages": [{"role": "user", "content": content}],
            "tools": TOOLS,
            "tool_choice": "auto"
        }
    )
    
    result = response.json()
    message = result['choices'][0]['message']
    
    # 3. 处理工具调用
    if 'tool_calls' in message:
        tool_results = []
        for tool_call in message['tool_calls']:
            result = execute_tool(
                tool_call['function']['name'],
                json.loads(tool_call['function']['arguments'])
            )
            tool_results.append({
                "role": "tool",
                "tool_call_id": tool_call['id'],
                "content": result
            })
        
        # 第二次调用
        response = requests.post(
            OPENAI_BASE_URL,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json={
                "model": "MiniMax-M2.5",
                "messages": [
                    {"role": "user", "content": content},
                    message,
                    *tool_results
                ]
            }
        )
        result = response.json()
        ai_content = result['choices'][0]['message']['content']
    else:
        ai_content = message['content']
    
    # 4. 保存 AI 回复
    cursor.execute(
        "INSERT INTO messages (id, session_id, role, content) VALUES (%s, %s, %s, %s)",
        (f"msg_{datetime.now().timestamp()}", session_id, 'ai', ai_content)
    )
    db.commit()
    
    return jsonify({"aiReply": {"content": ai_content}})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### 14.2 建表 SQL

```sql
-- database/init.sql

CREATE DATABASE IF NOT EXISTS myagent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE myagent;

-- 主人表
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 会话表
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    visitor_name VARCHAR(100),
    status ENUM('active', 'taken_over', 'closed') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_updated (updated_at)
);

-- 消息表
CREATE TABLE messages (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    role ENUM('visitor', 'ai', 'owner') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_created (created_at)
);

-- 登录凭证表
CREATE TABLE tokens (
    token VARCHAR(100) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
    INDEX idx_owner (owner_id),
    INDEX idx_expires (expires_at)
);

-- 在线状态表
CREATE TABLE online_status (
    owner_id VARCHAR(50) PRIMARY KEY,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- 插入测试数据
INSERT INTO owners (id, name, bio, ai_name, ai_persona, email, password_hash) VALUES
('jennia', 'Jennia', '专注 AI 应用开发', 'Jennia的AI助手', '你是 Jennia 的 AI 分身', 'jennia@example.com', '$2b$12$...');
```

---

## 15. 总结

### 关键要点

1. **当前架构**：Cloudflare Pages + Hono (TypeScript) + KV 存储
2. **后端位置**：`src/routes/api.ts`（运行在 Cloudflare Workers 边缘节点）
3. **数据存储**：Cloudflare KV（简单键值对，类似 Redis）
4. **改造目标**：本地后端（Python/Node.js）+ 传统数据库（MySQL）
5. **推荐方案**：Docker Compose（Flask + MySQL + Redis）
6. **开发周期**：10-15 天
7. **成本**：本地开发免费，VPS 部署 $5-50/月

### 决策建议

- **如果只是学习**：用 Flask + SQLite（最简单）
- **如果要生产环境**：继续用 Cloudflare 或用 Docker 部署到 VPS
- **如果不想写 TypeScript**：建议使用 AI 辅助工具（Cursor/Copilot）

### 下一步

请告诉我：
1. 您期望用什么语言？（Python/Node.js/Java/Go）
2. 是否有 Docker 经验？
3. 是否需要部署到生产环境？

我会根据您的回答，提供**详细的实现代码和部署指南**。

---

**文档结束**

如有任何问题，请随时询问！ 😊
