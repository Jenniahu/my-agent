# my-agent

一个基于 **Cloudflare Pages + Hono + OpenAI Function Calling** 的个人 AI 助手平台。主人可以配置自己的 AI 分身，访客可以通过主页与 AI 对话，主人后台可实时查看会话并接管对话。

## 🎯 核心功能

### ✅ 已完成
- ✨ **访客对话**：支持 Markdown 渲染 + 打断重问功能
- 🤖 **AI 工具调用**：集成 OpenAI Function Calling（时间查询、主人信息搜索）
- 👤 **主人后台**：实时会话列表、消息查看、人工接管
- 💾 **数据存储**：基于 Cloudflare KV 的会话管理
- 📝 **上下文管理**：保留最近 40 条对话记录
- 🎨 **UI 优化**：Tailwind CSS + FontAwesome 图标

### 🚧 待实现
- [ ] D1 数据库迁移（替代 KV 存储）
- [ ] 更多工具集成（天气、搜索、API 调用等）
- [ ] 会话历史导出
- [ ] 多主人支持

---

## 📡 在线体验

- **生产环境**: https://my-agent-ao2.pages.dev/u/jennia
- **GitHub**: https://github.com/Jenniahu/my-agent
- **API 端点**: `https://my-agent-ao2.pages.dev/api/*`

---

## 🛠️ 技术栈

- **后端框架**: Hono (Cloudflare Workers 专用轻量框架)
- **前端**: Vanilla JS + Tailwind CSS + Marked.js
- **存储服务**: Cloudflare KV (键值存储)
- **AI 模型**: MiniMax-M2.5 (通过 OpenAI 兼容端点)
- **部署平台**: Cloudflare Pages

---

## 🚀 本地开发

### 安装依赖
```bash
npm install
```

### 配置环境变量
创建 `.dev.vars` 文件：
```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://llm.mcisaas.com
```

### 启动开发服务器
```bash
npm run build
npm run dev:sandbox  # 监听 0.0.0.0:3000
```

### 访问应用
```bash
# 访客页面
http://localhost:3000/u/jennia

# 主人后台
http://localhost:3000/owner/login
```

---

## 📦 部署到 Cloudflare Pages

### 1. 构建项目
```bash
npm run build
```

### 2. 部署
```bash
npx wrangler pages deploy dist --project-name my-agent
```

### 3. 配置环境变量（生产环境）
```bash
# 在 Cloudflare Dashboard 配置 Secrets
npx wrangler pages secret put OPENAI_API_KEY --project-name my-agent
npx wrangler pages secret put OPENAI_BASE_URL --project-name my-agent
```

---

## 🔧 工具调用架构

### 工具定义位置
**在 `src/routes/api.ts` 顶部定义工具数组**：

```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间（北京时间）',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
]
```

### 工具执行函数
**在同一文件中实现 `executeToolCall` 函数**：

```typescript
async function executeToolCall(
  name: string,
  args: any,
  owner: Owner
): Promise<string> {
  switch (name) {
    case 'get_current_time':
      const now = new Date()
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      return JSON.stringify({
        time: beijingTime.toISOString().replace('T', ' ').substring(0, 19),
        timezone: 'Asia/Shanghai'
      })
    
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}
```

### OpenAI Function Calling 流程

```
┌─────────────┐   1️⃣ 用户消息 + 工具定义    ┌─────────────┐
│  访客发送   │ ────────────────────────→  │  后端 API   │
│  "几点了？" │                            │  /chat      │
└─────────────┘                            └─────────────┘
                                                  ↓
                                        2️⃣ 调用 OpenAI
                                        {
                                          model: "MiniMax-M2.5",
                                          messages: [...],
                                          tools: [...]  ← 关键！
                                        }
                                                  ↓
                                           ┌─────────────┐
                                           │  OpenAI API │
                                           └─────────────┘
                                                  ↓
                                        返回 tool_calls:
                                        {
                                          "id": "call_abc123",
                                          "function": {
                                            "name": "get_current_time",
                                            "arguments": "{}"
                                          }
                                        }
                                                  ↓
                                        3️⃣ 后端执行工具
                                        result = executeToolCall('get_current_time')
                                        → "{"time":"2026-04-09 11:32:00"}"
                                                  ↓
                                        4️⃣ 再次调用 OpenAI
                                        messages.push({
                                          role: 'tool',
                                          tool_call_id: 'call_abc123',
                                          content: result
                                        })
                                                  ↓
                                        返回最终回复：
                                        "现在是 2026年4月9日 上午11:32（上海时间）"
                                                  ↓
┌─────────────┐                       ┌─────────────┐
│  前端展示   │ ←────────────────────  │  后端返回   │
│  AI 回复    │                        │  aiReply    │
└─────────────┘                        └─────────────┘
```

---

## 🔍 工具调用原理详解

### 1️⃣ **为什么工具在后端执行？**

- **安全性**：API 密钥不暴露到前端
- **性能**：Cloudflare Workers 边缘计算，全球低延迟
- **可靠性**：后端统一管理工具调用逻辑

### 2️⃣ **OpenAI 如何判断是否需要工具？**

在请求中传入 `tools` 参数后，OpenAI 会：
1. 分析用户意图（如 "几点了？" → 需要时间信息）
2. 返回 `tool_calls` 数组（而不是直接回复文本）
3. 后端根据 `function.name` 调用对应的 `executeToolCall`
4. 将工具结果再发给 OpenAI，生成自然语言回复

### 3️⃣ **如何添加新工具？**

**步骤 1：在 `tools` 数组添加定义**
```typescript
{
  type: 'function',
  function: {
    name: 'get_weather',
    description: '查询指定城市的天气',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名，如 北京、上海' }
      },
      required: ['city']
    }
  }
}
```

**步骤 2：在 `executeToolCall` 添加实现**
```typescript
case 'get_weather':
  const response = await fetch(`https://api.weather.com?q=${args.city}`)
  const data = await response.json()
  return JSON.stringify(data)
```

**步骤 3：重新部署**
```bash
npm run build
npm run deploy
```

---

## 📊 数据架构

### 存储服务：Cloudflare KV

| Key 格式 | 值类型 | 说明 | TTL |
|---------|--------|------|-----|
| `owner:{id}` | Owner 对象 | 主人基本信息 | 永久 |
| `session:{id}` | Session 对象 | 会话元数据 | 30 天 |
| `msgs:{session_id}` | Message[] 数组 | 会话消息列表 | 30 天 |
| `token:{token}` | string (ownerId) | 登录凭证 | 1 天 |
| `online:{owner_id}` | 'true'/'false' | 主人在线状态 | 1 小时 |

### 数据模型

```typescript
interface Owner {
  id: string          // 主人唯一标识
  name: string        // 显示名称
  bio: string         // 个人简介
  avatar: string      // 头像 URL
  ai_name: string     // AI 助手名称
  ai_persona: string  // AI 人格设定
  email: string       // 邮箱
  password_hash: string
  created_at: string
}

interface Session {
  id: string
  owner_id: string
  visitor_name: string | null
  status: 'active' | 'taken_over' | 'closed'
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  session_id: string
  role: 'visitor' | 'ai' | 'owner'
  content: string
  created_at: string
}
```

---

## 📖 API 文档

### 访客端 API

#### 创建会话
```bash
POST /api/sessions
Content-Type: application/json

{
  "ownerId": "jennia",
  "visitorName": "访客名称"
}

# 响应
{ "sessionId": "uuid" }
```

#### 发送消息并获取 AI 回复
```bash
POST /api/sessions/:sessionId/chat
Content-Type: application/json

{
  "content": "你好"
}

# 响应（无需工具调用）
{
  "visitorMessageId": "uuid",
  "aiReply": {
    "id": "uuid",
    "content": "你好呀！有什么想聊的吗？😊"
  },
  "ownerOnline": false
}

# 响应（触发工具调用）
{
  "visitorMessageId": "uuid",
  "aiReply": {
    "id": "uuid",
    "content": "现在是 2026年4月9日 上午11:32（上海时间）"
  },
  "ownerOnline": false
}
```

#### 轮询新消息
```bash
GET /api/sessions/:sessionId/messages?since=2026-04-09T03:30:00.000Z

# 响应
{
  "messages": [
    {
      "id": "uuid",
      "role": "ai",
      "content": "你好",
      "created_at": "2026-04-09T03:35:00.000Z"
    }
  ],
  "session": {
    "id": "uuid",
    "status": "active",
    "is_owner_online": 0
  }
}
```

---

## 🎨 前端架构

### 访客页面 (`public/static/visitor-chat.js`)

**核心功能**：
- ✅ 会话初始化 (`initSession`)
- ✅ 消息发送 (`sendMessage`)
- ✅ 打断重问 (`cancelWaiting`)
- ✅ 轮询新消息 (`startPolling`)
- ✅ Markdown 渲染 (`renderMd`)

**状态管理**：
```javascript
let sessionId = null        // 当前会话 ID
let lastTs = ''             // 最后消息时间戳
let isWaiting = false       // 是否正在等待 AI 回复
let currentAbortId = null   // 用于打断的请求 ID
const renderedIds = new Set() // 防止重复渲染消息
```

---

## 🐛 常见问题

### Q: 如何测试工具调用是否正常？
```bash
# 创建会话
SESSION_ID=$(curl -s -X POST https://my-agent-ao2.pages.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}' | jq -r '.sessionId')

# 测试时间工具
curl -s -X POST "https://my-agent-ao2.pages.dev/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "现在几点了？"}' | jq -r '.aiReply.content'

# 测试搜索工具
curl -s -X POST "https://my-agent-ao2.pages.dev/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "jennia有哪些RAG项目？"}' | jq -r '.aiReply.content'
```

### Q: 工具调用失败怎么排查？
1. 检查 Cloudflare 日志：`npx wrangler pages deployment tail --project-name my-agent`
2. 查看后端日志中的 `[AI]` 标记
3. 确认 OpenAI API 端点支持 Function Calling（MiniMax-M2.5 支持）

### Q: 如何集成外部 API（如天气、搜索）？
在 `executeToolCall` 中使用 `fetch` 调用第三方 API：
```typescript
case 'get_weather':
  const resp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${args.city}&appid=${env.WEATHER_API_KEY}`)
  const data = await resp.json()
  return JSON.stringify(data)
```

---

## 📝 开发日志

### 2026-04-09
- ✅ 接入 OpenAI Function Calling
- ✅ 实现时间查询工具
- ✅ 实现主人信息搜索工具
- ✅ 修复访客页 JS 语法错误（模板字符串嵌套问题）
- ✅ 扩展上下文到 40 条消息
- ✅ 增加 max_tokens 到 1500

---

## 📄 许可证

MIT License

---

## 👨‍💻 作者

- **Jennia** - AI 应用开发工程师
- **GitHub**: https://github.com/Jenniahu
- **专注领域**: Workflow 搭建、RAG 系统、AI 原生应用
