# my-agent 项目整体 PRD 文档

## 📋 文档信息

**版本**: v1.0  
**创建日期**: 2026-04-09  
**最后更新**: 2026-04-09  
**项目名称**: my-agent - 个人 AI 助手平台  
**GitHub**: https://github.com/Jenniahu/my-agent  
**在线演示**: https://my-agent-ao2.pages.dev/u/jennia

---

## 🎯 项目概述

### 核心定位

**my-agent** 是一个基于 **OpenAI Function Calling** 的个人 AI 助手平台，允许主人配置自己的 AI 分身，访客可以通过主页与 AI 对话，主人可以实时查看会话并接管对话。

### 核心价值

1. **个人 IP 打造**：每个人都可以拥有自己的 AI 分身
2. **工具化 Agent**：支持灵活的工具扩展（时间查询、信息搜索、API 调用等）
3. **人机协同**：AI 自动回复 + 主人可随时接管
4. **技术可控**：开源、可自部署、数据可控

---

## 📊 当前状态

### 已完成功能（v1.0 - Cloudflare 版本）

#### 1. 前端功能
- ✅ 访客对话页面（`/u/:ownerId`）
- ✅ Markdown 渲染（支持代码块、列表、引用等）
- ✅ 打断重问功能（停止 AI 生成，重新提问）
- ✅ 实时消息轮询（2 秒一次）
- ✅ 在线状态显示（主人是否在线）
- ✅ 响应式布局（移动端适配）

#### 2. 主人后台功能
- ✅ 登录/登出系统
- ✅ 会话列表查看（实时更新）
- ✅ 会话详情查看（消息历史）
- ✅ 人工接管对话
- ✅ 个人信息编辑（AI 人格、头像、简介）
- ✅ 在线状态管理（心跳机制）

#### 3. AI 功能
- ✅ OpenAI Function Calling 集成
- ✅ 工具调用系统（时间查询、信息搜索）
- ✅ 上下文管理（保留最近 40 条消息）
- ✅ 自定义 AI 人格设定
- ✅ 双轮对话机制（工具调用 → 自然语言生成）

#### 4. 技术架构
- ✅ Cloudflare Pages 部署（全球 CDN）
- ✅ Hono 框架（TypeScript）
- ✅ Cloudflare KV 存储（键值对数据库）
- ✅ PM2 进程管理（开发环境）
- ✅ Git 版本控制

### 当前技术栈

```
前端
├── HTML5 + CSS3 + JavaScript (ES6+)
├── Tailwind CSS（样式框架）
├── Marked.js（Markdown 渲染）
└── Axios/Fetch（HTTP 请求）

后端（Cloudflare Workers）
├── Hono（轻量级 Web 框架）
├── TypeScript（类型安全）
└── Cloudflare KV（数据存储）

部署
├── Cloudflare Pages（前端 + 后端）
├── GitHub Actions（CI/CD）
└── PM2（本地开发）
```

### 数据模型（KV 存储）

```
owner:{id}       → Owner 对象（主人信息）
session:{id}     → Session 对象（会话信息）
msgs:{sessionId} → Message[] 数组（消息列表）
token:{token}    → ownerId（登录凭证）
online:{ownerId} → 'true'/'false'（在线状态）
```

---

## 🚀 计划中的改造（v2.0 - Python 本地版本）

### 改造目标

将当前的 **Cloudflare Pages (TypeScript)** 架构改造为 **Python 本地后端**，以支持更灵活的 Agent 扩展和复杂业务逻辑。

### 改造原因

| 当前痛点 | Python 方案优势 |
|---------|----------------|
| ❌ TypeScript 不熟悉 | ✅ Python 生态丰富，开发效率高 |
| ❌ KV 存储功能简单 | ✅ 关系型数据库（SQLite/MySQL）支持复杂查询 |
| ❌ 无法文件上传 | ✅ 支持文件上传、定时任务、WebSocket |
| ❌ 边缘计算限制 | ✅ 可使用 Python 丰富的第三方库 |

### 目标技术栈（v2.0）

```
前端（保持不变）
├── HTML5 + CSS3 + JavaScript
├── Tailwind CSS
└── Marked.js

后端（Python）
├── Flask（Web 框架）✅ 推荐
│   或 FastAPI（异步支持，性能更好）
├── SQLAlchemy（ORM，数据库抽象层）
├── SQLite（本地开发数据库）
│   → MySQL/PostgreSQL（生产环境）
├── Requests（HTTP 客户端）
└── python-dotenv（环境变量管理）

部署（可选）
├── Docker Compose（容器化部署）
├── Nginx（反向代理）
└── Supervisor（进程管理）
```

### 数据库设计（关系型）

```sql
-- owners 表（主人信息）
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

-- sessions 表（会话信息）
CREATE TABLE sessions (
    id VARCHAR(50) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    visitor_name VARCHAR(100),
    status ENUM('active', 'taken_over', 'closed') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- messages 表（消息记录）
CREATE TABLE messages (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    role ENUM('visitor', 'ai', 'owner') NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- tokens 表（登录凭证）
CREATE TABLE tokens (
    token VARCHAR(100) PRIMARY KEY,
    owner_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- online_status 表（在线状态）
CREATE TABLE online_status (
    owner_id VARCHAR(50) PRIMARY KEY,
    is_online BOOLEAN DEFAULT FALSE,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);
```

### 工具系统设计

```
backend/tools/
├── base.py              # 工具基类（抽象类）
├── time_tool.py         # 时间查询工具
├── search_tool.py       # 信息搜索工具
├── weather_tool.py      # 天气查询工具（示例）
├── web_search_tool.py   # 网络搜索工具（示例）
└── custom_tool.py       # 自定义工具模板

特性：
1. 自动加载：放入 tools/ 目录即可自动注册
2. 统一接口：继承 BaseTool，实现 name、description、execute
3. 类型安全：使用 JSON Schema 定义参数
4. 易于扩展：复制模板即可添加新工具
```

---

## 📁 项目结构

### 当前结构（Cloudflare 版本）

```
webapp/
├── src/                           # 源代码
│   ├── index.tsx                  # 主入口
│   ├── routes/
│   │   ├── api.ts                 # 🔴 核心 API（工具调用在这里）
│   │   ├── visitor.ts             # 访客页面路由
│   │   └── owner.ts               # 主人后台路由
│   └── lib/
│       └── utils.ts               # 工具函数
│
├── public/                        # 静态资源
│   └── static/
│       ├── visitor-chat.js        # 访客页面 JS
│       └── style.css              # 自定义样式
│
├── docs/                          # 📚 项目文档
│   ├── PROJECT_PRD.md             # 🔴 本文档（项目整体 PRD）
│   ├── PYTHON_IMPLEMENTATION.md   # Python 实现技术文档
│   ├── LOCAL_BACKEND_PRD.md       # 本地后端改造 PRD
│   ├── QUICK_REFERENCE.md         # Python 快速参考
│   ├── function-calling-explained.md  # 工具调用原理
│   ├── tool-examples.js           # 工具示例代码
│   ├── TOOL_IMPLEMENTATION_SUMMARY.md # 工具实现总结
│   └── PROJECT_STRUCTURE.txt      # 项目结构说明
│
├── scripts/                       # 脚本
│   └── test-tools.sh              # 工具调用测试脚本
│
├── migrations/                    # 数据库迁移（预留）
│   ├── 0001_init.sql
│   └── 0002_seed.sql
│
├── package.json                   # Node.js 依赖
├── tsconfig.json                  # TypeScript 配置
├── wrangler.jsonc                 # Cloudflare 配置
├── ecosystem.config.cjs           # PM2 配置
└── README.md                      # 项目说明
```

### 计划结构（Python 版本）

```
my-agent-python/
├── backend/                       # 🆕 Python 后端
│   ├── app.py                     # Flask 主应用
│   ├── config.py                  # 配置文件
│   ├── models.py                  # 数据模型（SQLAlchemy）
│   ├── routes/                    # API 路由
│   │   ├── __init__.py
│   │   ├── session.py             # 会话管理 API
│   │   ├── message.py             # 消息管理 API
│   │   └── owner.py               # 主人管理 API
│   ├── services/                  # 业务逻辑
│   │   ├── __init__.py
│   │   ├── ai_service.py          # AI 调用服务
│   │   └── tool_service.py        # 工具管理服务
│   ├── tools/                     # 工具实现
│   │   ├── __init__.py
│   │   ├── base.py                # 工具基类
│   │   ├── time_tool.py           # 时间查询
│   │   ├── search_tool.py         # 信息搜索
│   │   └── custom_tool.py         # 自定义模板
│   ├── utils/                     # 工具函数
│   │   ├── __init__.py
│   │   ├── auth.py                # 认证工具
│   │   └── helpers.py             # 辅助函数
│   ├── myagent.db                 # SQLite 数据库（自动生成）
│   ├── requirements.txt           # Python 依赖
│   ├── .env                       # 环境变量
│   └── README.md                  # 后端文档
│
├── frontend/                      # 前端（从 public/ 复制）
│   ├── index.html
│   └── static/
│       ├── visitor-chat.js        # 需修改 API 地址
│       └── style.css
│
├── docs/                          # 文档（保留）
├── tests/                         # 测试（可选）
├── docker-compose.yml             # Docker 配置（可选）
└── README.md                      # 项目总文档
```

---

## 🔧 核心功能模块

### 1. 会话管理模块

**功能**：
- 创建会话（访客访问主人页面）
- 查询会话列表（主人后台）
- 查询会话详情（消息历史）
- 更新会话状态（active/taken_over/closed）

**API**：
```
POST   /api/sessions                        # 创建会话
GET    /api/sessions/:id/messages           # 获取消息
GET    /api/owner/sessions                  # 主人会话列表
PATCH  /api/owner/sessions/:id/status       # 更新状态
```

### 2. 消息管理模块

**功能**：
- 保存访客消息
- 调用 AI 生成回复
- 保存 AI 回复
- 主人人工回复
- 消息去重（防止轮询重复显示）

**API**：
```
POST   /api/sessions/:id/chat               # 访客发送消息 + AI 回复
POST   /api/owner/sessions/:id/reply        # 主人人工回复
```

### 3. 工具调用模块

**功能**：
- 工具定义（OpenAI Function Calling 格式）
- 工具执行（根据 name 调用对应实现）
- 工具结果处理（JSON 格式化）
- 工具自动加载（扫描 tools/ 目录）

**已实现工具**：
- `get_current_time`：获取当前北京时间
- `search_owner_info`：搜索主人的技能、项目经验

**工具接口**：
```python
class BaseTool(ABC):
    @property
    def name(self) -> str:
        """工具名称"""
        pass
    
    @property
    def description(self) -> str:
        """工具描述"""
        pass
    
    @property
    def parameters(self) -> dict:
        """参数定义（JSON Schema）"""
        pass
    
    def execute(self, args: dict, owner) -> str:
        """执行工具（返回 JSON 字符串）"""
        pass
```

### 4. 主人管理模块

**功能**：
- 主人注册（email + password）
- 主人登录（JWT 或 Session）
- 个人信息编辑（AI 人格、头像、简介）
- 在线状态管理（心跳机制）

**API**：
```
POST   /api/owner/register                  # 注册
POST   /api/owner/login                     # 登录
POST   /api/owner/logout                    # 登出
GET    /api/owner/profile                   # 获取信息
PUT    /api/owner/profile                   # 更新信息
POST   /api/owner/heartbeat                 # 心跳
```

### 5. AI 服务模块

**功能**：
- OpenAI API 调用封装
- 工具调用集成（Function Calling）
- 上下文管理（保留 40 条消息）
- 错误处理（API 失败、超时等）

**工作流程**：
```
1. 构建消息列表（系统 prompt + 历史消息 + 新消息）
2. 第一次调用 OpenAI（附带工具列表）
3. 检查是否返回 tool_calls
4. 如果有 tool_calls，执行工具
5. 第二次调用 OpenAI（附带工具结果）
6. 返回最终自然语言回复
```

---

## 📖 文档体系

### 核心文档

| 文档 | 用途 | 适用人群 |
|-----|------|---------|
| **PROJECT_PRD.md** | 项目整体 PRD，了解全貌 | 新加入开发者、产品经理 |
| **PYTHON_IMPLEMENTATION.md** | Python 技术实现细节（30KB） | Python 后端开发者 |
| **QUICK_REFERENCE.md** | Python 快速参考 | 开发时查阅 |
| **LOCAL_BACKEND_PRD.md** | 本地后端改造 PRD（22KB） | 技术决策者 |
| **function-calling-explained.md** | 工具调用原理深度解析 | AI 集成开发者 |
| **tool-examples.js** | 工具添加示例代码 | 工具开发者 |
| **TOOL_IMPLEMENTATION_SUMMARY.md** | 工具实现总结 | 工具开发者 |
| **PROJECT_STRUCTURE.txt** | 项目结构说明 | 新加入开发者 |

### 文档导航

```
入门路径：
1. PROJECT_PRD.md（本文档）
   → 了解项目背景、目标、当前状态
2. PYTHON_IMPLEMENTATION.md
   → 了解 Python 实现方案
3. QUICK_REFERENCE.md
   → 开始开发

工具开发路径：
1. function-calling-explained.md
   → 理解工具调用原理
2. tool-examples.js
   → 查看工具示例
3. TOOL_IMPLEMENTATION_SUMMARY.md
   → 了解已实现的工具

架构设计路径：
1. LOCAL_BACKEND_PRD.md
   → 了解架构演进
2. PROJECT_STRUCTURE.txt
   → 了解目录结构
```

---

## 🛠️ 开发指南

### 环境要求

**当前版本（Cloudflare）**：
- Node.js 18+
- npm 或 pnpm
- Wrangler CLI
- PM2（本地开发）

**Python 版本（计划）**：
- Python 3.11+
- pip
- SQLite（内置，无需安装）
- 可选：Docker、MySQL

### 快速启动（当前版本）

```bash
# 1. 克隆项目
git clone https://github.com/Jenniahu/my-agent.git
cd my-agent

# 2. 安装依赖
npm install

# 3. 配置环境变量
cat > .dev.vars << EOF
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://llm.mcisaas.com
EOF

# 4. 构建项目
npm run build

# 5. 启动开发服务器
npm run dev:sandbox
# 或使用 PM2
pm2 start ecosystem.config.cjs

# 6. 访问
# 前端: http://localhost:3000/u/jennia
# API: http://localhost:3000/api/ping
```

### 快速启动（Python 版本）

```bash
# 1. 创建后端目录
mkdir -p backend
cd backend

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cat > .env << EOF
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://llm.mcisaas.com
DEBUG=True
EOF

# 4. 启动服务
python app.py

# 5. 访问
# 后端: http://localhost:5000/api/ping
```

### 测试命令

```bash
# 测试 API
bash scripts/test-tools.sh

# 手动测试
curl http://localhost:3000/api/ping

# 创建会话
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}'

# 发送消息
curl -X POST http://localhost:3000/api/sessions/xxx/chat \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}'
```

---

## 🎯 开发计划

### Phase 1: Python 后端基础搭建（Week 1-2）

**目标**：完成 Python 后端的基本框架

**任务**：
- [ ] 创建项目目录结构
- [ ] 实现数据模型（SQLAlchemy）
- [ ] 实现配置文件（config.py）
- [ ] 实现主应用（app.py）
- [ ] 实现会话管理 API
- [ ] 实现消息管理 API
- [ ] 测试数据库 CRUD

**交付物**：
- 可运行的 Flask 应用
- SQLite 数据库自动建表
- 基本 API 测试通过

### Phase 2: AI 服务与工具系统（Week 3）

**目标**：实现 AI 调用和工具系统

**任务**：
- [ ] 实现 AI 服务类（ai_service.py）
- [ ] 实现工具服务类（tool_service.py）
- [ ] 实现工具基类（base.py）
- [ ] 实现时间工具（time_tool.py）
- [ ] 实现搜索工具（search_tool.py）
- [ ] 测试工具调用

**交付物**：
- 完整的 OpenAI Function Calling 集成
- 自动加载工具机制
- 至少 2 个示例工具

### Phase 3: 前端对接与联调（Week 4）

**目标**：前后端打通

**任务**：
- [ ] 修改前端 API 地址
- [ ] 处理 CORS 跨域
- [ ] 测试前后端联调
- [ ] 优化错误处理
- [ ] 添加日志记录

**交付物**：
- 前后端完全打通
- 所有功能测试通过
- 错误日志完善

### Phase 4: 优化与扩展（Week 5+）

**目标**：功能增强和性能优化

**任务**：
- [ ] 数据库切换到 MySQL（可选）
- [ ] 添加更多工具（天气、搜索、API 调用等）
- [ ] 性能优化（缓存、索引）
- [ ] 安全加固（SQL 防注入、XSS）
- [ ] 单元测试
- [ ] Docker 部署方案

**交付物**：
- 生产级代码质量
- 完整测试覆盖
- 部署文档

---

## 💡 技术决策

### 为什么选择 Flask？

| 优势 | 说明 |
|-----|------|
| ✅ **简单易学** | Python 熟悉的开发者可快速上手 |
| ✅ **轻量级** | 核心库小，启动快，适合小型项目 |
| ✅ **灵活** | 可按需添加功能，不强制任何架构 |
| ✅ **生态好** | 大量插件和中间件 |
| ✅ **文档全** | 官方文档完善，社区活跃 |

**备选方案**：FastAPI（异步支持，性能更好，但学习曲线稍陡）

### 为什么选择 SQLite？

| 优势 | 说明 |
|-----|------|
| ✅ **零配置** | 无需安装 MySQL/PostgreSQL |
| ✅ **单文件** | `myagent.db` 一个文件搞定 |
| ✅ **Python 内置** | `import sqlite3` 即用 |
| ✅ **支持 SQL** | 完整的关系型数据库功能 |
| ✅ **易迁移** | 后续可轻松切换到 MySQL |

**升级路径**：SQLite → MySQL → PostgreSQL → 云数据库

### 为什么用 SQLAlchemy ORM？

| 优势 | 说明 |
|-----|------|
| ✅ **面向对象** | 用 Python 类操作数据库 |
| ✅ **自动建表** | 无需手写 SQL DDL |
| ✅ **防注入** | 自动参数化查询 |
| ✅ **易切换** | SQLite/MySQL/PostgreSQL 只需改配置 |
| ✅ **关系管理** | 自动处理外键和关联查询 |

### Docker 是否必需？

**当前阶段**：❌ **不必需**

**原因**：
- SQLite 无需 Docker 容器
- 本地开发直接 `python app.py` 即可
- Docker 增加学习成本

**何时使用 Docker**：
- 部署到服务器时（推荐）
- 需要 MySQL/PostgreSQL 时
- 团队协作时（统一环境）

---

## 🔐 安全考虑

### 当前实现

1. **密码哈希**：使用 `werkzeug.security.generate_password_hash`
2. **CORS 配置**：限制跨域访问
3. **环境变量**：敏感信息存 `.env` 文件
4. **SQL 注入防护**：使用参数化查询

### 计划增强（Python 版本）

1. **JWT 认证**：替代 session token
2. **Rate Limiting**：防止 API 滥用
3. **HTTPS 强制**：生产环境必须 HTTPS
4. **SQL 防注入**：SQLAlchemy ORM 自动防护
5. **XSS 过滤**：前端输入校验

---

## 📊 性能指标

### 当前性能（Cloudflare）

| 指标 | 值 | 说明 |
|-----|---|------|
| **响应时间** | <200ms | 全球边缘节点 |
| **并发支持** | 10万+/天 | 免费版限制 |
| **存储限制** | 1GB | KV 免费版 |
| **请求限制** | 10万/天 | 免费版 |

### 预期性能（Python 本地）

| 指标 | 值 | 说明 |
|-----|---|------|
| **响应时间** | <100ms | 本地网络 |
| **并发支持** | 100-1000 | 取决于服务器配置 |
| **存储限制** | 无限 | 本地磁盘 |
| **请求限制** | 无限 | 自己控制 |

---

## 🐛 已知问题

### 当前版本（Cloudflare）

1. ❌ **模板字符串嵌套问题**（已修复）
   - 问题：JS 嵌入 HTML 导致反引号转义错误
   - 解决：将 JS 抽取到 `public/static/visitor-chat.js`

2. ✅ **Markdown 渲染问题**（已修复）
   - 问题：`marked.setOptions` 在 v9+ 废弃
   - 解决：改用 `marked.parse(text, {breaks: true})`

3. ✅ **DOM 未就绪问题**（已修复）
   - 问题：顶层代码在 DOM 加载前执行
   - 解决：使用 `DOMContentLoaded` 事件

### Python 版本（待实现）

暂无已知问题。

---

## 📈 未来规划

### 短期（1-3 个月）

- [ ] 完成 Python 后端迁移
- [ ] 添加 10+ 工具（天气、搜索、翻译、计算器等）
- [ ] 文件上传功能
- [ ] 会话历史导出（PDF/JSON）
- [ ] 多语言支持（中英文）

### 中期（3-6 个月）

- [ ] 多主人支持（多租户架构）
- [ ] WebSocket 实时通信
- [ ] 语音对话（TTS/STT）
- [ ] 图片生成工具集成（DALL-E）
- [ ] 移动端 App

### 长期（6-12 个月）

- [ ] AI Agent 编排（多 Agent 协作）
- [ ] 插件市场（工具共享）
- [ ] SaaS 化（付费订阅）
- [ ] 企业版（私有化部署）

---

## 📞 联系方式

### 项目信息

- **GitHub**: https://github.com/Jenniahu/my-agent
- **在线演示**: https://my-agent-ao2.pages.dev/u/jennia
- **作者**: Jennia
- **邮箱**: jennia@example.com（示例）

### 问题反馈

- 提交 GitHub Issue
- 查看项目文档 `docs/`
- 参考快速参考 `docs/QUICK_REFERENCE.md`

---

## 🎓 学习资源

### Python 学习

- **Flask 官方文档**: https://flask.palletsprojects.com/
- **SQLAlchemy 文档**: https://docs.sqlalchemy.org/
- **Python 官方文档**: https://docs.python.org/3/

### AI 相关

- **OpenAI API 文档**: https://platform.openai.com/docs/
- **LangChain 文档**: https://python.langchain.com/
- **Function Calling 指南**: 参考 `docs/function-calling-explained.md`

### 部署相关

- **Docker 官方文档**: https://docs.docker.com/
- **Nginx 文档**: https://nginx.org/en/docs/
- **Supervisor 文档**: http://supervisord.org/

---

## 📝 变更日志

### v1.0 (2026-04-09)

**新增功能**：
- ✅ OpenAI Function Calling 集成
- ✅ 时间查询工具
- ✅ 信息搜索工具
- ✅ Markdown 渲染
- ✅ 打断重问功能
- ✅ 上下文扩展到 40 条
- ✅ max_tokens 提升到 1500

**Bug 修复**：
- ✅ 修复 JS 模板字符串嵌套问题
- ✅ 修复 marked.setOptions 废弃问题
- ✅ 修复 DOM 未就绪导致的脚本错误

**文档更新**：
- ✅ 新增 7 篇技术文档（60KB+）
- ✅ 新增自动化测试脚本
- ✅ 完善 README

**部署**：
- ✅ 部署到 Cloudflare Pages
- ✅ 推送到 GitHub

### v2.0 (计划中)

**架构升级**：
- [ ] 迁移到 Python 后端
- [ ] SQLite 数据库
- [ ] SQLAlchemy ORM
- [ ] 工具自动加载系统

**新增功能**：
- [ ] 文件上传
- [ ] 定时任务
- [ ] WebSocket 实时通信
- [ ] 更多工具（天气、搜索、翻译等）

---

## 🙏 致谢

感谢以下开源项目：

- **Hono**: 轻量级 Web 框架
- **Cloudflare Pages**: 全球 CDN 部署
- **Flask**: Python Web 框架
- **SQLAlchemy**: Python ORM
- **Marked.js**: Markdown 渲染
- **Tailwind CSS**: 样式框架

---

## 📄 许可证

MIT License

---

**文档结束**

**新 session 开发者请先阅读本文档，了解项目全貌后再开始开发！** 😊

**SQL 和 Docker 不熟悉？没关系！**
- SQL：使用 SQLAlchemy ORM，无需手写 SQL
- Docker：本地开发不需要 Docker，直接 `python app.py` 即可

**下一步**：告诉我 "生成完整 Python 代码"，我会创建所有文件！ 🚀
