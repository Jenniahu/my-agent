# 工具调用功能实现总结

## ✅ 已完成

### 1. 核心功能实现

**文件**: `src/routes/api.ts`

#### 🛠️ 已实现的工具

| 工具名称 | 功能 | 参数 | 示例问题 |
|---------|------|------|---------|
| `get_current_time` | 获取当前北京时间 | 无 | "现在几点了？" |
| `search_owner_info` | 搜索主人的技能/项目 | `keyword` (string) | "jennia有哪些RAG项目？" |

#### 🔄 工作流程

```
用户提问 → 后端收到 → 调用 OpenAI (附带工具列表)
  ↓
OpenAI 判断需要工具 → 返回 tool_calls
  ↓
后端执行工具 (executeToolCall) → 获取结果
  ↓
再次调用 OpenAI (附带工具结果) → 生成自然语言
  ↓
返回给用户
```

### 2. 文档完善

#### 📚 已创建文档

- ✅ **README.md**: 完整的项目文档
- ✅ **docs/function-calling-explained.md**: 工具调用原理深度解析
- ✅ **docs/tool-examples.js**: 工具添加示例（天气、搜索、日历、汇率）
- ✅ **scripts/test-tools.sh**: 自动化测试脚本

### 3. 测试验证

**测试脚本**: `scripts/test-tools.sh`

运行结果：
```
✓ 会话创建成功
✓ 工具调用: get_current_time ✅
✓ 工具调用: search_owner_info ✅
✓ 普通对话: 正常 ✅
```

---

## 📋 工具定义位置

### 在项目中的位置

```
src/routes/api.ts
├── Line 11-77:   工具定义 (tools 数组)
├── Line 79-140:  工具执行 (executeToolCall 函数)
└── Line 258-367: OpenAI 调用逻辑（Function Calling）
```

### 代码结构

```typescript
// 1️⃣ 定义工具
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间（北京时间）',
      parameters: { ... }
    }
  }
]

// 2️⃣ 实现工具
async function executeToolCall(name, args, owner) {
  switch (name) {
    case 'get_current_time':
      return JSON.stringify({ time: '...' })
  }
}

// 3️⃣ 调用 OpenAI
const resp = await fetch(apiUrl, {
  body: JSON.stringify({
    model: 'MiniMax-M2.5',
    messages: [...],
    tools: tools,  // ← 传入工具列表
    tool_choice: 'auto'
  })
})

// 4️⃣ 处理工具调用
if (message?.tool_calls) {
  for (const toolCall of message.tool_calls) {
    const result = await executeToolCall(...)
    toolMessages.push({ role: 'tool', content: result })
  }
  
  // 第二次调用
  resp = await fetch(apiUrl, {
    body: JSON.stringify({
      messages: [...messages, ...toolMessages]
    })
  })
}
```

---

## 🔍 OpenAI Function Calling 原理

### 核心概念

**Function Calling** = OpenAI 模型调用外部工具获取实时信息

### 关键特性

1. **不是"已集成工具"**：OpenAI 本身没有内置工具，所有工具需要**你自己实现**
2. **后端执行**：工具在服务器端执行，确保 API 密钥安全
3. **双轮对话**：第一次获取 `tool_calls`，第二次生成自然语言回复

### 工作流程

```
┌──────────┐
│ 用户问题 │  "现在几点了？"
└─────┬────┘
      ↓
┌─────────────────────────────────┐
│ 后端调用 OpenAI (第一次)        │
│ - messages: [...]               │
│ - tools: [get_current_time]     │
│ - tool_choice: 'auto'           │
└─────┬───────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ OpenAI 返回 tool_calls          │
│ {                               │
│   "id": "call_abc123",          │
│   "function": {                 │
│     "name": "get_current_time", │
│     "arguments": "{}"           │
│   }                             │
│ }                               │
└─────┬───────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ 后端执行工具                    │
│ result = executeToolCall(       │
│   'get_current_time'            │
│ )                               │
│ → "{"time":"2026-04-09 11:37"}" │
└─────┬───────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ 后端调用 OpenAI (第二次)        │
│ - messages: [                   │
│     ...原始消息,                │
│     { role: 'tool',             │
│       content: result }         │
│   ]                             │
└─────┬───────────────────────────┘
      ↓
┌─────────────────────────────────┐
│ OpenAI 返回自然语言回复         │
│ "现在北京时间 2026年4月9日      │
│  上午11:37。"                   │
└─────┬───────────────────────────┘
      ↓
┌──────────┐
│ 返回用户 │
└──────────┘
```

---

## 🛠️ 如何添加新工具

### 步骤 1：定义工具

在 `src/routes/api.ts` 的 `tools` 数组中添加：

```typescript
{
  type: 'function',
  function: {
    name: 'get_weather',  // 工具名称
    description: '查询指定城市的实时天气信息',  // 描述（AI 根据此判断何时调用）
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称，如 "北京"、"上海"'
        }
      },
      required: ['city']
    }
  }
}
```

### 步骤 2：实现工具

在 `executeToolCall` 函数中添加：

```typescript
case 'get_weather':
  try {
    // 调用外部 API（需要配置 API key）
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${args.city}&appid=${env.WEATHER_API_KEY}`
    )
    const data = await response.json()
    
    // 必须返回 JSON 字符串
    return JSON.stringify({
      city: args.city,
      temperature: data.main.temp,
      description: data.weather[0].description
    })
  } catch (error) {
    return JSON.stringify({ error: '天气查询失败' })
  }
```

### 步骤 3：配置环境变量（如需）

**本地开发** (`.dev.vars`)：
```env
WEATHER_API_KEY=your-api-key
```

**生产环境**：
```bash
npx wrangler pages secret put WEATHER_API_KEY --project-name my-agent
```

### 步骤 4：更新 Bindings 类型

```typescript
type Bindings = {
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
  WEATHER_API_KEY?: string  // 新增
}
```

### 步骤 5：构建部署

```bash
npm run build
npm run deploy
```

### 步骤 6：测试

```bash
# 创建会话
SESSION_ID=$(curl -s -X POST https://my-agent-ao2.pages.dev/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"ownerId": "jennia"}' | jq -r '.sessionId')

# 测试新工具
curl -s -X POST "https://my-agent-ao2.pages.dev/api/sessions/${SESSION_ID}/chat" \
  -H "Content-Type: application/json" \
  -d '{"content": "北京今天天气怎么样？"}' | jq -r '.aiReply.content'
```

---

## 📚 参考文档

### 项目文档

- **README.md**: 项目总览和快速开始
- **docs/function-calling-explained.md**: 原理深度解析
- **docs/tool-examples.js**: 工具示例（天气、搜索、日历、汇率）

### 外部资源

- [OpenAI Function Calling 官方文档](https://platform.openai.com/docs/guides/function-calling)
- [JSON Schema 规范](https://json-schema.org/)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Hono 框架文档](https://hono.dev/)

---

## ❓ 常见问题

### Q: OpenAI 有哪些"已集成工具"？

**A**: OpenAI **没有内置工具**，所有工具都需要你自己实现。但你可以通过调用第三方 API 实现类似功能：

- 网络搜索：SerpAPI、Brave Search
- 天气查询：OpenWeatherMap
- 地图位置：Google Maps API
- 代码执行：E2B Sandbox
- 图片生成：DALL-E 3

### Q: 工具在哪里执行？

**A**: 工具在**后端（Cloudflare Workers）**执行，理由：
- ✅ 安全：API 密钥不暴露到前端
- ✅ 可靠：统一管理工具调用逻辑
- ✅ 性能：全球边缘计算，低延迟

### Q: 如何判断工具是否被调用？

**A**: 检查后端日志：
```bash
npx wrangler pages deployment tail --project-name my-agent
```

查找 `[AI] Tool calls requested` 标记。

### Q: 工具调用失败怎么办？

**A**: 常见原因：
1. **description 不清晰**：AI 无法判断何时使用
2. **参数定义错误**：JSON Schema 格式不正确
3. **API 超时**：外部 API 响应慢
4. **模型不支持**：确认使用支持 Function Calling 的模型

### Q: 如何优化工具调用速度？

**A**: 优化策略：
- 使用流式响应（Streaming）
- 缓存工具结果（相同请求不重复调用）
- 并行执行多个工具
- 减少外部 API 调用延迟

---

## 🎯 下一步建议

1. **尝试添加新工具**：参考 `docs/tool-examples.js`
2. **集成第三方 API**：如天气、搜索、地图等
3. **优化工具性能**：添加缓存和错误重试
4. **扩展 AI 能力**：接入更多数据源

---

## 📊 测试结果

**测试时间**: 2026-04-09  
**测试环境**: https://my-agent-ao2.pages.dev

| 测试项 | 结果 | 说明 |
|-------|------|------|
| 会话创建 | ✅ 通过 | Session ID: 3383046f-... |
| 时间查询工具 | ✅ 通过 | 正确返回北京时间 |
| 信息搜索工具 | ✅ 通过 | 正确搜索主人项目 |
| 普通对话 | ✅ 通过 | 无工具调用时正常回复 |
| 消息历史 | ✅ 通过 | 正确保存对话记录 |

---

**文档版本**: v1.0  
**作者**: Jennia  
**GitHub**: https://github.com/Jenniahu/my-agent  
**在线演示**: https://my-agent-ao2.pages.dev/u/jennia
