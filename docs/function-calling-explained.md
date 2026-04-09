# 工具调用原理深度解析

本文档详细解释 **OpenAI Function Calling** 在 Cloudflare Workers + Hono 项目中的实现原理。

---

## 📚 目录

1. [核心概念](#核心概念)
2. [调用流程](#调用流程)
3. [代码位置](#代码位置)
4. [实现细节](#实现细节)
5. [集成已有工具](#集成已有工具)
6. [常见问题](#常见问题)

---

## 核心概念

### 什么是 Function Calling？

**Function Calling**（函数调用）是 OpenAI 在 2023 年推出的功能，允许 AI 模型**调用外部工具**来获取实时信息或执行操作。

**传统对话 vs Function Calling**：

```
┌──────────────────────────────────────────────────────────┐
│  传统对话（无工具）                                       │
├──────────────────────────────────────────────────────────┤
│  用户: "北京现在几点？"                                   │
│  AI:  "抱歉，我无法获取实时时间信息。"  ❌               │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Function Calling（有工具）                               │
├──────────────────────────────────────────────────────────┤
│  用户: "北京现在几点？"                                   │
│  AI:  调用 get_current_time() 工具                       │
│       → 返回 "2026-04-09 11:32:00"                       │
│  AI:  "现在是 2026年4月9日 上午11:32（北京时间）" ✅     │
└──────────────────────────────────────────────────────────┘
```

### 为什么需要后端执行工具？

**安全性**：API 密钥不能暴露到前端
**可靠性**：后端统一管理工具调用逻辑
**性能**：Cloudflare Workers 全球边缘计算，低延迟

---

## 调用流程

### 完整流程图

```
┌─────────────┐
│  访客前端   │
│  (浏览器)   │
└──────┬──────┘
       │
       │ 1️⃣ POST /api/sessions/:id/chat
       │    { content: "北京天气怎么样？" }
       ↓
┌─────────────────────────────────────────────────┐
│  后端 API                                        │
│  src/routes/api.ts                               │
├─────────────────────────────────────────────────┤
│                                                  │
│  2️⃣ 构建请求：                                  │
│     {                                            │
│       model: "MiniMax-M2.5",                     │
│       messages: [...历史消息],                   │
│       tools: [                                   │
│         {                                        │
│           type: "function",                      │
│           function: {                            │
│             name: "get_weather",                 │
│             description: "查询城市天气",         │
│             parameters: {...}                    │
│           }                                      │
│         }                                        │
│       ]                                          │
│     }                                            │
│                                                  │
│  3️⃣ 第一次调用 OpenAI API                       │
│     POST https://llm.mcisaas.com/v1/chat/completions
│                                                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
          ┌────────────────┐
          │  OpenAI / 模型  │
          │   (MiniMax)    │
          └────────┬───────┘
                   │
                   │ 4️⃣ 模型分析用户意图
                   │    → 判断需要调用工具
                   │
                   ↓
          返回 tool_calls:
          {
            "choices": [{
              "message": {
                "role": "assistant",
                "content": null,
                "tool_calls": [{
                  "id": "call_abc123",
                  "type": "function",
                  "function": {
                    "name": "get_weather",
                    "arguments": "{\"city\":\"北京\"}"
                  }
                }]
              }
            }]
          }
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│  后端 API                                        │
│  5️⃣ 执行工具：                                  │
│                                                  │
│  const result = await executeToolCall(          │
│    'get_weather',                                │
│    { city: '北京' },                             │
│    owner                                         │
│  )                                               │
│                                                  │
│  → result = {                                    │
│      temperature: 22,                            │
│      description: "晴转多云"                     │
│    }                                             │
│                                                  │
│  6️⃣ 构建新请求（包含工具结果）：                │
│     messages = [                                 │
│       ...原始消息,                                │
│       {                                          │
│         role: "assistant",                       │
│         content: null,                           │
│         tool_calls: [...]                        │
│       },                                         │
│       {                                          │
│         role: "tool",                            │
│         tool_call_id: "call_abc123",             │
│         name: "get_weather",                     │
│         content: "{\"temperature\":22,...}"      │
│       }                                          │
│     ]                                            │
│                                                  │
│  7️⃣ 第二次调用 OpenAI API                       │
│                                                  │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
          ┌────────────────┐
          │  OpenAI / 模型  │
          └────────┬───────┘
                   │
                   │ 8️⃣ 模型根据工具结果生成自然语言
                   │
                   ↓
          返回最终回复:
          {
            "choices": [{
              "message": {
                "role": "assistant",
                "content": "北京今天天气不错，22度，晴转多云。"
              }
            }]
          }
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│  后端 API                                        │
│  9️⃣ 保存消息并返回：                            │
│     {                                            │
│       aiReply: {                                 │
│         id: "...",                               │
│         content: "北京今天天气不错..."           │
│       }                                          │
│     }                                            │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
          ┌─────────────┐
          │  访客前端   │
          │  显示回复   │
          └─────────────┘
```

---

## 代码位置

### 文件结构

```
src/
├── routes/
│   ├── api.ts          ← 🔴 工具定义和执行逻辑都在这里
│   ├── visitor.ts      ← 访客页面路由
│   └── owner.ts        ← 主人后台路由
├── lib/
│   └── utils.ts        ← 辅助函数
└── index.tsx           ← 主入口

public/static/
└── visitor-chat.js     ← 前端 JavaScript
```

### 核心代码位置

**在 `src/routes/api.ts` 中：**

1. **工具定义区** (第 11-77 行)：
```typescript
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间（北京时间）',
      parameters: { ... }
    }
  },
  // ... 更多工具
]
```

2. **工具执行区** (第 79-140 行)：
```typescript
async function executeToolCall(
  name: string,
  args: any,
  owner: Owner
): Promise<string> {
  switch (name) {
    case 'get_current_time':
      // 实现逻辑
      return JSON.stringify({ ... })
    
    case 'search_owner_info':
      // 实现逻辑
      return JSON.stringify({ ... })
    
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}
```

3. **调用 OpenAI 区** (第 258-367 行)：
```typescript
apiRoutes.post('/sessions/:sessionId/chat', async (c) => {
  // ... 前置逻辑 ...
  
  // 第一次调用（传入工具列表）
  let resp = await fetch(apiUrl, {
    method: 'POST',
    body: JSON.stringify({
      model: 'MiniMax-M2.5',
      messages,
      tools,  // ← 关键！
      tool_choice: 'auto'
    })
  })
  
  // 检查是否需要调用工具
  if (message?.tool_calls) {
    // 执行工具
    for (const toolCall of message.tool_calls) {
      const result = await executeToolCall(...)
      toolMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      })
    }
    
    // 第二次调用（传入工具结果）
    resp = await fetch(apiUrl, {
      body: JSON.stringify({
        messages: [...messages, ...toolMessages]
      })
    })
  }
})
```

---

## 实现细节

### 1. 工具定义（OpenAI Schema）

OpenAI 使用 **JSON Schema** 格式定义工具参数：

```typescript
{
  type: 'function',
  function: {
    name: 'get_weather',           // 工具名称（唯一标识）
    description: '查询指定城市的实时天气信息',  // 描述（AI 根据此判断何时调用）
    parameters: {                  // 参数定义
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称，如 "北京"、"上海"'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: '温度单位'
        }
      },
      required: ['city']           // 必填参数
    }
  }
}
```

### 2. 工具执行函数

**关键点**：
- **输入**：工具名称、参数对象、Owner 信息
- **输出**：**必须是 JSON 字符串**（OpenAI 要求）
- **错误处理**：返回结构化错误信息

```typescript
async function executeToolCall(
  name: string,
  args: any,
  owner: Owner
): Promise<string> {
  try {
    switch (name) {
      case 'get_weather':
        // 调用外部 API
        const response = await fetch(
          `https://api.weather.com?q=${args.city}`
        )
        const data = await response.json()
        
        // ⚠️ 必须返回 JSON 字符串
        return JSON.stringify({
          city: args.city,
          temperature: data.temp,
          description: data.weather
        })
      
      default:
        return JSON.stringify({ error: 'Unknown tool' })
    }
  } catch (error) {
    // 错误也要返回 JSON 字符串
    return JSON.stringify({
      error: 'Tool execution failed',
      message: String(error)
    })
  }
}
```

### 3. 双轮对话机制

**为什么需要调用两次 OpenAI？**

```
第一次调用：
输入：用户消息 + 工具列表
输出：tool_calls（告诉你需要调用哪些工具）

第二次调用：
输入：原始消息 + tool_calls + 工具结果
输出：自然语言回复（基于工具结果）
```

**代码示例**：

```typescript
// 第一次调用
let resp1 = await fetch(apiUrl, {
  body: JSON.stringify({
    model: 'MiniMax-M2.5',
    messages: [
      { role: 'system', content: '...' },
      { role: 'user', content: '北京天气怎么样？' }
    ],
    tools: [...]
  })
})

const data1 = await resp1.json()
const toolCalls = data1.choices[0].message.tool_calls
// toolCalls = [{
//   id: "call_abc123",
//   function: {
//     name: "get_weather",
//     arguments: "{\"city\":\"北京\"}"
//   }
// }]

// 执行工具
const toolResult = await executeToolCall('get_weather', { city: '北京' })
// toolResult = "{\"temperature\":22,\"description\":\"晴\"}"

// 第二次调用
let resp2 = await fetch(apiUrl, {
  body: JSON.stringify({
    model: 'MiniMax-M2.5',
    messages: [
      { role: 'system', content: '...' },
      { role: 'user', content: '北京天气怎么样？' },
      {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls
      },
      {
        role: 'tool',
        tool_call_id: 'call_abc123',
        name: 'get_weather',
        content: toolResult
      }
    ]
  })
})

const data2 = await resp2.json()
const finalReply = data2.choices[0].message.content
// finalReply = "北京今天天气不错，22度，晴转多云。"
```

---

## 集成已有工具

### OpenAI 官方已集成工具

**目前 OpenAI 没有"已集成工具"**，所有工具都需要**自己实现**。

但可以通过调用第三方 API 实现类似功能：

| 功能 | 推荐 API | 示例 |
|-----|---------|------|
| 网络搜索 | SerpAPI, Brave Search | `https://serpapi.com/search?q=...` |
| 天气查询 | OpenWeatherMap | `https://api.openweathermap.org/data/2.5/weather` |
| 地图位置 | Google Maps API | `https://maps.googleapis.com/maps/api/geocode/json` |
| 图片生成 | DALL-E 3, Stable Diffusion | `https://api.openai.com/v1/images/generations` |
| 代码执行 | E2B Sandbox | `https://api.e2b.dev/v1/sandboxes` |

### Anthropic Claude 的工具调用

Anthropic 的 **Claude 3.5** 也支持 Function Calling，格式类似：

```typescript
const response = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "北京天气怎么样？" }],
  tools: [
    {
      name: "get_weather",
      description: "查询城市天气",
      input_schema: {
        type: "object",
        properties: {
          city: { type: "string" }
        }
      }
    }
  ]
})
```

**区别**：
- OpenAI 使用 `parameters`，Claude 使用 `input_schema`
- OpenAI 使用 `tool_calls`，Claude 使用 `tool_use`

---

## 常见问题

### Q1: 为什么我的工具没有被调用？

**可能原因**：
1. **description 不够清晰**：AI 无法判断何时使用
2. **参数定义错误**：JSON Schema 格式不正确
3. **模型不支持**：确保使用支持 Function Calling 的模型

**解决方案**：
```typescript
// ❌ 不好的 description
description: '天气'

// ✅ 好的 description
description: '查询指定城市的实时天气信息，包括温度、湿度、天气状况'
```

### Q2: 工具调用太慢怎么办？

**优化策略**：
1. **使用流式响应**（Streaming）：边生成边返回
2. **缓存工具结果**：相同请求不重复调用
3. **并行执行工具**：多个工具同时调用

```typescript
// 并行执行多个工具
const results = await Promise.all(
  toolCalls.map(tc => executeToolCall(tc.function.name, JSON.parse(tc.function.arguments)))
)
```

### Q3: 如何限制工具调用次数？

**方案 1：在 API 层限制**
```typescript
let toolCallCount = 0
const MAX_TOOL_CALLS = 3

if (message?.tool_calls) {
  toolCallCount++
  if (toolCallCount > MAX_TOOL_CALLS) {
    return c.json({ error: '工具调用次数超限' }, 429)
  }
}
```

**方案 2：使用 KV 存储计数**
```typescript
const key = `tool_call_count:${sessionId}`
const count = parseInt(await c.env.KV.get(key) || '0')

if (count >= 10) {
  return c.json({ error: '今日工具调用次数已用完' }, 429)
}

await c.env.KV.put(key, String(count + 1), { expirationTtl: 86400 })
```

### Q4: 如何处理工具调用失败？

**最佳实践**：
```typescript
async function executeToolCall(name: string, args: any): Promise<string> {
  try {
    const response = await fetch(`https://api.example.com?q=${args.query}`, {
      signal: AbortSignal.timeout(5000)  // 5秒超时
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    return JSON.stringify(data)
    
  } catch (error) {
    console.error(`[Tool Error] ${name}:`, error)
    
    // 返回友好的错误信息（AI 会转换为自然语言）
    return JSON.stringify({
      error: true,
      message: '抱歉，工具调用失败，请稍后重试',
      details: String(error)
    })
  }
}
```

### Q5: 能否让 AI 自动判断是否使用工具？

**可以！使用 `tool_choice: 'auto'`**：

```typescript
// 让 AI 自动决定
tool_choice: 'auto'

// 强制使用某个工具
tool_choice: {
  type: 'function',
  function: { name: 'get_weather' }
}

// 禁用工具调用
tool_choice: 'none'
```

---

## 总结

### 核心要点

1. **工具定义**：在 `src/routes/api.ts` 的 `tools` 数组
2. **工具执行**：在 `executeToolCall` 函数中实现
3. **双轮对话**：第一次获取 `tool_calls`，第二次生成自然语言
4. **返回格式**：必须是 JSON 字符串
5. **错误处理**：返回结构化错误信息

### 下一步

- ✅ 查看 `docs/tool-examples.js` 了解更多工具示例
- ✅ 阅读 `README.md` 了解部署流程
- ✅ 在 https://my-agent-ao2.pages.dev/u/jennia 测试工具调用

---

**文档版本**: v1.0  
**最后更新**: 2026-04-09  
**作者**: Jennia
