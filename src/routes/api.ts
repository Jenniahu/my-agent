// src/routes/api.ts - 基于 KV 存储的核心 API
import { Hono } from 'hono'
import { generateId, verifyPassword, hashPassword, kv } from '../lib/utils'

type Bindings = {
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
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
  const recent = history.slice(-20)

  const systemPrompt = owner.ai_persona ||
    `你是 ${owner.name} 的 AI 分身，名叫 ${owner.ai_name}。请代表他/她友好、专业地和来访者对话。`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recent.map(m => ({
      role: m.role === 'visitor' ? 'user' : 'assistant',
      content: m.content,
    }))
  ]

  // 调用 OpenAI
  let aiContent = '你好！有什么可以帮你的吗？'
  try {
    const baseUrl = (c.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '')
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    })
    if (resp.ok) {
      const data = await resp.json() as any
      aiContent = data.choices?.[0]?.message?.content || aiContent
    }
  } catch (e) {
    console.error('OpenAI error:', e)
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
