// src/routes/api.ts - 基于 KV 存储的核心 API
import { Hono } from 'hono'
import { generateId, verifyPassword, hashPassword, kv } from '../lib/utils'

type Bindings = {
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

// ─── 工具定义 ─────────────────────────────────
// 这里定义 AI 可以调用的工具
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
  },
  {
    type: 'function',
    function: {
      name: 'search_owner_info',
      description: '搜索主人的专业技能、项目经验或服务信息',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词，如 "RAG"、"workflow"、"AI应用"'
          }
        },
        required: ['keyword']
      }
    }
  }
]

// ─── 工具执行函数 ─────────────────────────────
// 当 OpenAI 返回 tool_call 时，这里负责实际执行
async function executeToolCall(
  name: string,
  args: any,
  owner: Owner
): Promise<string> {
  switch (name) {
    case 'get_current_time':
      // 示例：返回当前北京时间
      const now = new Date()
      const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
      return JSON.stringify({
        time: beijingTime.toISOString().replace('T', ' ').substring(0, 19),
        timezone: 'Asia/Shanghai'
      })

    case 'search_owner_info':
      // 示例：搜索主人的信息（实际应查询数据库）
      const keyword = args.keyword?.toLowerCase() || ''
      const mockProjects = [
        { name: '客服知识库系统', type: 'RAG', year: 2024, tech: ['Dify', 'Cloudflare D1'] },
        { name: '审批自动化流程', type: 'workflow', year: 2024, tech: ['n8n', 'API集成'] },
        { name: 'AI原生应用开发', type: 'ai_native', year: 2024, tech: ['Hono', 'OpenAI'] }
      ]
      const filtered = mockProjects.filter(p => 
        p.name.toLowerCase().includes(keyword) || 
        p.type.toLowerCase().includes(keyword)
      )
      return JSON.stringify({
        owner_name: owner.name,
        keyword: args.keyword,
        projects: filtered,
        bio: owner.bio
      })

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// ─── 类型定义 ─────────────────────────────────
interface Owner {
  id: string
  name: string
  bio: string
  avatar: string
  ai_name: string
  ai_persona: string
  email: string
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

// ─── KV 辅助函数 ─────────────────────────────
async function getOwner(kv_ns: KVNamespace, id: string): Promise<Owner | null> {
  const data = await kv_ns.get(kv.ownerKey(id))
  return data ? JSON.parse(data) : null
}

async function getSession(kv_ns: KVNamespace, id: string): Promise<Session | null> {
  const data = await kv_ns.get(kv.sessionKey(id))
  return data ? JSON.parse(data) : null
}

async function getMsgs(kv_ns: KVNamespace, sessionId: string): Promise<Message[]> {
  const data = await kv_ns.get(kv.msgsKey(sessionId))
  return data ? JSON.parse(data) : []
}

async function appendMsg(kv_ns: KVNamespace, sessionId: string, msg: Message): Promise<void> {
  const msgs = await getMsgs(kv_ns, sessionId)
  msgs.push(msg)
  // 只保留最近 100 条
  const trimmed = msgs.slice(-100)
  await kv_ns.put(kv.msgsKey(sessionId), JSON.stringify(trimmed), { expirationTtl: 86400 * 30 })
}

async function getOwnerSessions(kv_ns: KVNamespace, ownerId: string): Promise<string[]> {
  const data = await kv_ns.get(kv.sessionsKey(ownerId))
  return data ? JSON.parse(data) : []
}

async function addSessionToOwner(kv_ns: KVNamespace, ownerId: string, sessionId: string): Promise<void> {
  const ids = await getOwnerSessions(kv_ns, ownerId)
  ids.unshift(sessionId) // 最新在前
  await kv_ns.put(kv.sessionsKey(ownerId), JSON.stringify(ids.slice(0, 100)), { expirationTtl: 86400 * 90 })
}

// ─── 访客：获取主人主页信息 ───────────────────
apiRoutes.get('/profile/:ownerId', async (c) => {
  const ownerId = c.req.param('ownerId')
  const owner = await getOwner(c.env.KV, ownerId)
  if (!owner) return c.json({ error: 'Not found' }, 404)
  const { password_hash, ...pub } = owner
  return c.json(pub)
})

// ─── 访客：创建新会话 ─────────────────────────
apiRoutes.post('/sessions', async (c) => {
  const body = await c.req.json()
  const { ownerId, visitorName } = body
  if (!ownerId) return c.json({ error: 'ownerId required' }, 400)

  const owner = await getOwner(c.env.KV, ownerId)
  if (!owner) return c.json({ error: 'Owner not found' }, 404)

  const sessionId = generateId()
  const now = new Date().toISOString()
  const session: Session = {
    id: sessionId,
    owner_id: ownerId,
    visitor_name: visitorName || null,
    status: 'active',
    created_at: now,
    updated_at: now,
  }

  await c.env.KV.put(kv.sessionKey(sessionId), JSON.stringify(session), { expirationTtl: 86400 * 30 })
  await addSessionToOwner(c.env.KV, ownerId, sessionId)

  return c.json({ sessionId })
})

// ─── 获取会话消息 ──────────────────────────────
apiRoutes.get('/sessions/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId')
  const since = c.req.query('since')

  const session = await getSession(c.env.KV, sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  let msgs = await getMsgs(c.env.KV, sessionId)
  if (since) {
    msgs = msgs.filter(m => m.created_at > since)
  }

  const ownerOnline = await c.env.KV.get(kv.onlineKey(session.owner_id))

  return c.json({
    messages: msgs,
    session: { ...session, is_owner_online: ownerOnline === 'true' ? 1 : 0 }
  })
})

// ─── 访客发送消息并触发 AI 回复 ───────────────
apiRoutes.post('/sessions/:sessionId/chat', async (c) => {
  const sessionId = c.req.param('sessionId')
  const body = await c.req.json()
  const { content } = body
  if (!content?.trim()) return c.json({ error: 'Content required' }, 400)

  const session = await getSession(c.env.KV, sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const owner = await getOwner(c.env.KV, session.owner_id)
  if (!owner) return c.json({ error: 'Owner not found' }, 404)

  // 存访客消息
  const now = new Date().toISOString()
  const visitorMsg: Message = {
    id: generateId(),
    session_id: sessionId,
    role: 'visitor',
    content: content.trim(),
    created_at: now,
  }
  await appendMsg(c.env.KV, sessionId, visitorMsg)

  // 更新会话时间
  session.updated_at = now
  await c.env.KV.put(kv.sessionKey(sessionId), JSON.stringify(session), { expirationTtl: 86400 * 30 })

  // 检查主人是否在线
  const ownerOnline = await c.env.KV.get(kv.onlineKey(session.owner_id))
  if (ownerOnline === 'true') {
    return c.json({ visitorMessageId: visitorMsg.id, aiReply: null, ownerOnline: true })
  }

  // 获取历史消息构建上下文
  const history = await getMsgs(c.env.KV, sessionId)
  const recent = history.slice(-40)  // 扩展到 40 条上下文

  const systemPrompt = owner.ai_persona ||
    `你是 ${owner.name} 的 AI 分身，名叫 ${owner.ai_name}。请代表他/她友好、专业地和来访者对话。`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recent.map(m => ({
      role: m.role === 'visitor' ? 'user' : 'assistant',
      content: m.content,
    }))
  ]

  // 调用 OpenAI with Function Calling 支持
  let aiContent = '你好！有什么可以帮你的吗？'
  try {
    // 智能处理 URL：如果已经包含 /chat/completions 就直接用，否则拼接
    const rawUrl = (c.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
    const apiUrl = rawUrl.includes('/chat/completions')
      ? rawUrl
      : `${rawUrl}/v1/chat/completions`

    console.log('[AI] calling:', apiUrl)
    
    // 第一次调用：传入工具列表
    let resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5',
        messages,
        max_tokens: 1500,
        temperature: 0.7,
        tools,  // 传入工具定义
        tool_choice: 'auto'  // 让模型自动决定是否调用工具
      }),
    })
    
    if (resp.ok) {
      const data = await resp.json() as any
      const choice = data.choices?.[0]
      const message = choice?.message
      
      // 检查是否需要调用工具
      if (message?.tool_calls && message.tool_calls.length > 0) {
        console.log('[AI] Tool calls requested:', message.tool_calls.length)
        
        // 收集工具调用结果
        const toolMessages = []
        for (const toolCall of message.tool_calls) {
          const funcName = toolCall.function.name
          const funcArgs = JSON.parse(toolCall.function.arguments)
          
          console.log(`[AI] Executing tool: ${funcName}`, funcArgs)
          
          // 执行工具
          const result = await executeToolCall(funcName, funcArgs, owner)
          
          toolMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: funcName,
            content: result
          })
        }
        
        // 构建新的消息列表（原消息 + 模型工具调用 + 工具结果）
        const messagesWithTools = [
          ...messages,
          {
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls
          },
          ...toolMessages
        ]
        
        // 第二次调用：传入工具结果，让模型生成最终回复
        resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'MiniMax-M2.5',
            messages: messagesWithTools,
            max_tokens: 1500,
            temperature: 0.7,
          }),
        })
        
        if (resp.ok) {
          const finalData = await resp.json() as any
          aiContent = finalData.choices?.[0]?.message?.content || aiContent
          console.log('[AI] Final response with tools:', aiContent.substring(0, 100))
        }
      } else {
        // 无需调用工具，直接使用模型回复
        aiContent = message?.content || aiContent
        console.log('[AI] Direct response (no tools):', aiContent.substring(0, 100))
      }
    } else {
      const errText = await resp.text()
      console.error('[AI] API error:', resp.status, errText)
    }
  } catch (e) {
    console.error('[AI] fetch error:', e)
  }

  const aiMsg: Message = {
    id: generateId(),
    session_id: sessionId,
    role: 'ai',
    content: aiContent,
    created_at: new Date().toISOString(),
  }
  await appendMsg(c.env.KV, sessionId, aiMsg)

  return c.json({ visitorMessageId: visitorMsg.id, aiReply: { id: aiMsg.id, content: aiContent }, ownerOnline: false })
})

// ─── 主人登录 ──────────────────────────────────
apiRoutes.post('/owner/login', async (c) => {
  const { ownerId, password } = await c.req.json()
  const owner = await getOwner(c.env.KV, ownerId)
  if (!owner) return c.json({ error: '用户不存在' }, 401)

  const valid = await verifyPassword(password, owner.password_hash)
  if (!valid) return c.json({ error: '密码错误' }, 401)

  const token = generateId()
  await c.env.KV.put(kv.tokenKey(token), ownerId, { expirationTtl: 86400 })

  return c.json({ token, owner: { id: owner.id, name: owner.name, ai_name: owner.ai_name } })
})

// ─── 主人登出 ──────────────────────────────────
apiRoutes.post('/owner/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    const ownerId = await c.env.KV.get(kv.tokenKey(token))
    if (ownerId) await c.env.KV.delete(kv.onlineKey(ownerId))
    await c.env.KV.delete(kv.tokenKey(token))
  }
  return c.json({ ok: true })
})

// ─── 中间件：验证 token ───────────────────────
async function requireOwner(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const ownerId = await c.env.KV.get(kv.tokenKey(token))
  if (!ownerId) return c.json({ error: 'Token expired' }, 401)
  c.set('ownerId', ownerId)
  await next()
}

// ─── 主人：获取自己信息 ────────────────────────
apiRoutes.get('/owner/me', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const owner = await getOwner(c.env.KV, ownerId)
  if (!owner) return c.json({ error: 'Not found' }, 404)
  const { password_hash, ...pub } = owner
  return c.json(pub)
})

// ─── 主人：更新资料 ────────────────────────────
apiRoutes.put('/owner/profile', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const owner = await getOwner(c.env.KV, ownerId)
  if (!owner) return c.json({ error: 'Not found' }, 404)

  const { name, bio, avatar, ai_name, ai_persona, email, password } = await c.req.json()
  const updated: Owner = {
    ...owner,
    name: name ?? owner.name,
    bio: bio ?? owner.bio,
    avatar: avatar ?? owner.avatar,
    ai_name: ai_name ?? owner.ai_name,
    ai_persona: ai_persona ?? owner.ai_persona,
    email: email ?? owner.email,
  }
  if (password) {
    updated.password_hash = await hashPassword(password)
  }

  await c.env.KV.put(kv.ownerKey(ownerId), JSON.stringify(updated), { expirationTtl: 86400 * 365 })
  return c.json({ ok: true })
})

// ─── 主人：获取会话列表 ────────────────────────
apiRoutes.get('/owner/sessions', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const sessionIds = await getOwnerSessions(c.env.KV, ownerId)

  const sessions = await Promise.all(
    sessionIds.slice(0, 50).map(async (id) => {
      const s = await getSession(c.env.KV, id)
      if (!s) return null
      const msgs = await getMsgs(c.env.KV, id)
      const lastMsg = msgs[msgs.length - 1]
      return {
        ...s,
        last_message: lastMsg?.content || null,
        visitor_msg_count: msgs.filter(m => m.role === 'visitor').length,
      }
    })
  )

  return c.json({ sessions: sessions.filter(Boolean).sort((a: any, b: any) => b!.updated_at.localeCompare(a!.updated_at)) })
})

// ─── 主人：心跳 ────────────────────────────────
apiRoutes.post('/owner/heartbeat', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  await c.env.KV.put(kv.onlineKey(ownerId), 'true', { expirationTtl: 30 })
  return c.json({ ok: true })
})

// ─── 主人：回复会话 ────────────────────────────
apiRoutes.post('/owner/sessions/:sessionId/reply', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const sessionId = c.req.param('sessionId')
  const { content } = await c.req.json()
  if (!content?.trim()) return c.json({ error: 'Content required' }, 400)

  const session = await getSession(c.env.KV, sessionId)
  if (!session || session.owner_id !== ownerId) return c.json({ error: 'Session not found' }, 404)

  const msg: Message = {
    id: generateId(),
    session_id: sessionId,
    role: 'owner',
    content: content.trim(),
    created_at: new Date().toISOString(),
  }
  await appendMsg(c.env.KV, sessionId, msg)

  session.status = 'taken_over'
  session.updated_at = msg.created_at
  await c.env.KV.put(kv.sessionKey(sessionId), JSON.stringify(session), { expirationTtl: 86400 * 30 })

  return c.json({ ok: true, messageId: msg.id })
})

// ─── 主人注册（初次使用时创建账号）────────────
apiRoutes.post('/owner/register', async (c) => {
  const { id, name, password, invite_code } = await c.req.json()

  // 简单邀请码保护，防止陌生人乱注册
  if (invite_code !== 'MYFRIEND2025') {
    return c.json({ error: '邀请码错误' }, 403)
  }

  if (!id || !name || !password) return c.json({ error: '参数不完整' }, 400)
  if (!/^[a-z0-9_-]{2,30}$/.test(id)) return c.json({ error: '用户名只能包含小写字母、数字、_、-，2-30位' }, 400)

  const exists = await getOwner(c.env.KV, id)
  if (exists) return c.json({ error: '该用户名已被使用' }, 409)

  const owner: Owner = {
    id,
    name,
    bio: '',
    avatar: '🤖',
    ai_name: 'AI助手',
    ai_persona: `你是 ${name} 的 AI 分身。请代表 ${name} 友好、专业地和来访者对话。`,
    email: '',
    password_hash: await hashPassword(password),
    created_at: new Date().toISOString(),
  }

  await c.env.KV.put(kv.ownerKey(id), JSON.stringify(owner), { expirationTtl: 86400 * 365 })
  return c.json({ ok: true })
})

// ─── 轮询 ping ─────────────────────────────────
apiRoutes.get('/sessions/:sessionId/ping', async (c) => {
  const sessionId = c.req.param('sessionId')
  const session = await getSession(c.env.KV, sessionId)
  return c.json({ ts: session?.updated_at || '0' })
})

// ─── 临时调试：测试 AI 接口连通性 ──────────────
apiRoutes.get('/debug/ai-test', async (c) => {
  const rawUrl = (c.env.OPENAI_BASE_URL || '').replace(/\/$/, '')
  const apiUrl = rawUrl.includes('/chat/completions')
    ? rawUrl
    : `${rawUrl}/v1/chat/completions`
  const hasKey = !!c.env.OPENAI_API_KEY
  const keyPrefix = c.env.OPENAI_API_KEY?.slice(0, 8) + '...'

  let result: any = { apiUrl, hasKey, keyPrefix }

  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5',
        messages: [{ role: 'user', content: 'say hi' }],
        max_tokens: 10,
      }),
    })
    const text = await resp.text()
    result.status = resp.status
    result.ok = resp.ok
    result.response = text.slice(0, 500)
  } catch (e: any) {
    result.error = e?.message || String(e)
  }

  return c.json(result)
})
