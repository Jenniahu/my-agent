// ============================================
// 工具添加示例文件
// ============================================
// 这个文件展示如何在 src/routes/api.ts 中添加新工具

// ============================================
// 步骤 1：在 tools 数组中添加工具定义
// ============================================

const tools = [
  // ... 现有工具 ...
  
  // 🌤️ 示例 1：天气查询工具
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '查询指定城市的实时天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称，如 "北京"、"上海"、"深圳"'
          }
        },
        required: ['city']
      }
    }
  },

  // 🔍 示例 2：网络搜索工具
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '在互联网上搜索最新信息',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词'
          },
          count: {
            type: 'number',
            description: '返回结果数量（默认 3）',
            default: 3
          }
        },
        required: ['query']
      }
    }
  },

  // 📅 示例 3：日历事件工具
  {
    type: 'function',
    function: {
      name: 'check_calendar',
      description: '查询指定日期的日历事件和日程安排',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: '日期，格式 YYYY-MM-DD'
          }
        },
        required: ['date']
      }
    }
  },

  // 💰 示例 4：汇率转换工具
  {
    type: 'function',
    function: {
      name: 'convert_currency',
      description: '转换货币汇率',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: '金额'
          },
          from_currency: {
            type: 'string',
            description: '源货币代码，如 USD、CNY、EUR'
          },
          to_currency: {
            type: 'string',
            description: '目标货币代码'
          }
        },
        required: ['amount', 'from_currency', 'to_currency']
      }
    }
  }
]

// ============================================
// 步骤 2：在 executeToolCall 函数中实现工具逻辑
// ============================================

async function executeToolCall(
  name: string,
  args: any,
  owner: Owner
): Promise<string> {
  switch (name) {
    
    // ... 现有工具 ...

    // 🌤️ 实现天气查询
    case 'get_weather':
      try {
        // 方案 A：调用真实天气 API（需要配置 API key）
        // const response = await fetch(
        //   `https://api.openweathermap.org/data/2.5/weather?q=${args.city}&appid=${env.WEATHER_API_KEY}&units=metric&lang=zh_cn`
        // )
        // const data = await response.json()
        // return JSON.stringify({
        //   city: args.city,
        //   temperature: data.main.temp,
        //   description: data.weather[0].description,
        //   humidity: data.main.humidity
        // })

        // 方案 B：返回模拟数据（开发测试用）
        return JSON.stringify({
          city: args.city,
          temperature: 22,
          description: '晴转多云',
          humidity: 65,
          wind_speed: '3级',
          update_time: new Date().toISOString()
        })
      } catch (error) {
        return JSON.stringify({ error: '天气查询失败', message: String(error) })
      }

    // 🔍 实现网络搜索
    case 'web_search':
      try {
        // 方案 A：调用搜索 API（如 SerpAPI）
        // const response = await fetch(
        //   `https://serpapi.com/search?q=${encodeURIComponent(args.query)}&api_key=${env.SERP_API_KEY}&num=${args.count || 3}`
        // )
        // const data = await response.json()
        // return JSON.stringify(data.organic_results?.map(r => ({
        //   title: r.title,
        //   link: r.link,
        //   snippet: r.snippet
        // })))

        // 方案 B：返回模拟数据
        return JSON.stringify({
          query: args.query,
          results: [
            { title: '搜索结果 1', url: 'https://example.com/1', snippet: '这是第一条结果...' },
            { title: '搜索结果 2', url: 'https://example.com/2', snippet: '这是第二条结果...' }
          ]
        })
      } catch (error) {
        return JSON.stringify({ error: '搜索失败', message: String(error) })
      }

    // 📅 实现日历查询
    case 'check_calendar':
      try {
        // 这里可以连接到 Google Calendar API、Notion API 等
        // 示例返回模拟数据
        const events = [
          { time: '09:00', title: '团队会议', duration: '1小时' },
          { time: '14:00', title: '客户沟通', duration: '30分钟' },
          { time: '16:00', title: '代码审查', duration: '1小时' }
        ]
        
        return JSON.stringify({
          date: args.date,
          events: events,
          total: events.length
        })
      } catch (error) {
        return JSON.stringify({ error: '日历查询失败', message: String(error) })
      }

    // 💰 实现货币转换
    case 'convert_currency':
      try {
        // 方案 A：调用汇率 API
        // const response = await fetch(
        //   `https://api.exchangerate-api.com/v4/latest/${args.from_currency}`
        // )
        // const data = await response.json()
        // const rate = data.rates[args.to_currency]
        // const result = args.amount * rate
        
        // 方案 B：模拟汇率（仅供演示）
        const mockRates: Record<string, number> = {
          'USD-CNY': 7.2,
          'CNY-USD': 0.14,
          'USD-EUR': 0.92,
          'EUR-USD': 1.09
        }
        
        const key = `${args.from_currency}-${args.to_currency}`
        const rate = mockRates[key] || 1
        const result = args.amount * rate
        
        return JSON.stringify({
          amount: args.amount,
          from: args.from_currency,
          to: args.to_currency,
          rate: rate,
          result: result.toFixed(2)
        })
      } catch (error) {
        return JSON.stringify({ error: '汇率转换失败', message: String(error) })
      }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

// ============================================
// 步骤 3：配置环境变量（如需调用外部 API）
// ============================================

/**
 * 在 .dev.vars 文件中添加（本地开发）：
 * 
 * OPENAI_API_KEY=your-openai-key
 * OPENAI_BASE_URL=https://llm.mcisaas.com
 * WEATHER_API_KEY=your-weather-api-key
 * SERP_API_KEY=your-serpapi-key
 */

/**
 * 在生产环境配置 Secret：
 * 
 * npx wrangler pages secret put WEATHER_API_KEY --project-name my-agent
 * npx wrangler pages secret put SERP_API_KEY --project-name my-agent
 */

// ============================================
// 步骤 4：更新 Bindings 类型定义
// ============================================

/**
 * 在 src/routes/api.ts 顶部更新 Bindings 类型：
 * 
 * type Bindings = {
 *   KV: KVNamespace
 *   OPENAI_API_KEY: string
 *   OPENAI_BASE_URL: string
 *   WEATHER_API_KEY?: string    // 新增
 *   SERP_API_KEY?: string        // 新增
 * }
 */

// ============================================
// 步骤 5：测试工具调用
// ============================================

/**
 * 1. 构建并部署：
 *    npm run build
 *    npm run deploy
 * 
 * 2. 创建测试会话：
 *    SESSION_ID=$(curl -s -X POST https://your-app.pages.dev/api/sessions \
 *      -H "Content-Type: application/json" \
 *      -d '{"ownerId": "jennia"}' | jq -r '.sessionId')
 * 
 * 3. 测试天气工具：
 *    curl -s -X POST "https://your-app.pages.dev/api/sessions/${SESSION_ID}/chat" \
 *      -H "Content-Type: application/json" \
 *      -d '{"content": "北京今天天气怎么样？"}' | jq -r '.aiReply.content'
 * 
 * 4. 测试搜索工具：
 *    curl -s -X POST "https://your-app.pages.dev/api/sessions/${SESSION_ID}/chat" \
 *      -H "Content-Type: application/json" \
 *      -d '{"content": "帮我搜索 Cloudflare Workers 的最佳实践"}' | jq -r '.aiReply.content'
 * 
 * 5. 测试货币转换：
 *    curl -s -X POST "https://your-app.pages.dev/api/sessions/${SESSION_ID}/chat" \
 *      -H "Content-Type: application/json" \
 *      -d '{"content": "100美元等于多少人民币？"}' | jq -r '.aiReply.content'
 */

// ============================================
// 常见问题 FAQ
// ============================================

/**
 * Q1: 工具调用失败怎么办？
 * A1: 检查后端日志：npx wrangler pages deployment tail --project-name my-agent
 *     查看 [AI] 标记的日志，确认是否正确触发工具调用
 * 
 * Q2: 模型没有调用我的工具？
 * A2: 确保工具的 description 清晰描述功能，让 AI 能准确判断何时使用
 *     示例：'查询指定城市的实时天气信息' 优于 '天气'
 * 
 * Q3: 如何限制工具调用次数？
 * A3: 在 executeToolCall 中添加计数器或缓存逻辑
 * 
 * Q4: 工具执行超时怎么办？
 * A4: Cloudflare Workers 有 10ms CPU 时间限制（免费版）
 *     建议使用异步 API 调用，避免复杂计算
 * 
 * Q5: 如何处理工具调用错误？
 * A5: 在 executeToolCall 的 catch 块中返回友好错误信息
 *     AI 会将错误信息转换为自然语言告知用户
 */

// ============================================
// 最佳实践
// ============================================

/**
 * ✅ DO（推荐做法）：
 * - 工具名称使用小写 + 下划线（如 get_weather）
 * - description 清晰描述工具功能和使用场景
 * - 参数 description 详细说明格式和示例
 * - 使用 try-catch 捕获错误，返回结构化错误信息
 * - 外部 API 调用添加超时和重试逻辑
 * - 敏感信息（API key）存储在环境变量中
 * 
 * ❌ DON'T（不推荐做法）：
 * - 不要在工具中执行长时间计算（超过 50ms）
 * - 不要在工具中直接操作数据库（应通过 API）
 * - 不要返回过大的 JSON（超过 10KB）
 * - 不要在 description 中使用模糊语言
 * - 不要在前端暴露 API 密钥
 */

// ============================================
// 工具调用调试技巧
// ============================================

/**
 * 1. 添加日志：
 *    console.log(`[Tool] ${name} called with:`, args)
 *    console.log(`[Tool] ${name} result:`, result)
 * 
 * 2. 测试单个工具：
 *    const testResult = await executeToolCall('get_weather', { city: '北京' }, mockOwner)
 *    console.log(testResult)
 * 
 * 3. 查看 OpenAI 原始响应：
 *    console.log('[AI] Raw response:', JSON.stringify(data, null, 2))
 * 
 * 4. 检查工具是否被正确识别：
 *    if (message?.tool_calls) {
 *      console.log('[AI] Tool calls detected:', message.tool_calls)
 *    }
 */
