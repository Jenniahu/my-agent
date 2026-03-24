// src/routes/api.ts - 核心 API 路由
import { Hono } from 'hono'
import { generateId, verifyPassword, hashPassword, getOwnerOnlineKey, getSessionKey } from '../lib/utils'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

export const apiRoutes = new Hono<{ Bindings: Bindings }>()

// ─── 访客：获取主人主页信息 ───────────────────────────────────
apiRoutes.get('/profile/:ownerId', async (c) => {
  const ownerId = c.req.param('ownerId')
  const owner = await c.env.DB.prepare(
    'SELECT id, name, bio, avatar, ai_name, email FROM owners WHERE id = ?'
  ).bind(ownerId).first()

  if (!owner) return c.json({ error: 'Not found' }, 404)
  return c.json(owner)
})

// ─── 访客：创建新会话 ─────────────────────────────────────────
apiRoutes.post('/sessions', async (c) => {
  const body = await c.req.json()
  const { ownerId, visitorName } = body

  if (!ownerId) return c.json({ error: 'ownerId required' }, 400)

  // 检查主人是否存在
  const owner = await c.env.DB.prepare(
    'SELECT id FROM owners WHERE id = ?'
  ).bind(ownerId).first()
  if (!owner) return c.json({ error: 'Owner not found' }, 404)

  const sessionId = generateId()
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, owner_id, visitor_name) VALUES (?, ?, ?)'
  ).bind(sessionId, ownerId, visitorName || null).run()

  // 记录会话时间戳到 KV
  await c.env.KV.put(getSessionKey(sessionId), Date.now().toString(), { expirationTtl: 86400 * 7 })

  return c.json({ sessionId })
})

// ─── 访客/主人：获取会话消息 ──────────────────────────────────
apiRoutes.get('/sessions/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId')
  const since = c.req.query('since') // 时间戳，用于轮询增量

  let query = 'SELECT id, role, content, created_at FROM messages WHERE session_id = ?'
  const params: any[] = [sessionId]

  if (since) {
    query += ' AND created_at > ?'
    params.push(since)
  }
  query += ' ORDER BY created_at ASC'

  const { results } = await c.env.DB.prepare(query).bind(...params).all()

  // 获取会话基本信息
  const session = await c.env.DB.prepare(
    'SELECT id, owner_id, visitor_name, status, is_owner_online FROM sessions WHERE id = ?'
  ).bind(sessionId).first()

  return c.json({ messages: results, session })
})

// ─── 访客：发送消息并触发 AI 回复 ─────────────────────────────
apiRoutes.post('/sessions/:sessionId/chat', async (c) => {
  const sessionId = c.req.param('sessionId')
  const body = await c.req.json()
  const { content } = body

  if (!content?.trim()) return c.json({ error: 'Content required' }, 400)

  // 获取会话信息
  const session = await c.env.DB.prepare(
    'SELECT s.*, o.ai_name, o.ai_persona, o.name as owner_name FROM sessions s JOIN owners o ON s.owner_id = o.id WHERE s.id = ?'
  ).bind(sessionId).first() as any

  if (!session) return c.json({ error: 'Session not found' }, 404)

  // 存储访客消息
  const visitorMsgId = generateId()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(visitorMsgId, sessionId, 'visitor', content.trim(), now).run()

  // 更新会话时间
  await c.env.DB.prepare(
    'UPDATE sessions SET updated_at = ? WHERE id = ?'
  ).bind(now, sessionId).run()
  await c.env.KV.put(getSessionKey(sessionId), Date.now().toString(), { expirationTtl: 86400 * 7 })

  // 检查主人是否在线（在线时主人自己回，AI 暂不自动回）
  const ownerOnline = await c.env.KV.get(getOwnerOnlineKey(session.owner_id))
  if (ownerOnline === 'true') {
    // 主人在线，只存消息，等主人回复
    return c.json({
      visitorMessageId: visitorMsgId,
      aiReply: null,
      ownerOnline: true
    })
  }

  // 获取历史消息（最近 20 条，用于上下文）
  const { results: history } = await c.env.DB.prepare(
    'SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20'
  ).bind(sessionId).all() as { results: { role: string; content: string }[] }

  // 构建 OpenAI 消息列表
  const systemPrompt = session.ai_persona ||
    `你是 ${session.owner_name} 的 AI 分身，名叫 ${session.ai_name}。请代表他/她友好、专业地和来访者对话。`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role === 'visitor' ? 'user' : 'assistant',
      content: m.content
    }))
  ]

  // 调用 OpenAI API
  let aiContent = '抱歉，我现在无法回复，请稍后再试。'
  try {
    const baseUrl = c.env.OPENAI_BASE_URL || 'https://api.openai.com'
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (response.ok) {
      const data = await response.json() as any
      aiContent = data.choices?.[0]?.message?.content || aiContent
    }
  } catch (e) {
    console.error('OpenAI error:', e)
  }

  // 存储 AI 回复
  const aiMsgId = generateId()
  const aiNow = new Date().toISOString()
  await c.env.DB.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(aiMsgId, sessionId, 'ai', aiContent, aiNow).run()

  await c.env.KV.put(getSessionKey(sessionId), Date.now().toString(), { expirationTtl: 86400 * 7 })

  return c.json({
    visitorMessageId: visitorMsgId,
    aiReply: { id: aiMsgId, content: aiContent },
    ownerOnline: false
  })
})

// ─── 主人：登录 ───────────────────────────────────────────────
apiRoutes.post('/owner/login', async (c) => {
  const body = await c.req.json()
  const { ownerId, password } = body

  const owner = await c.env.DB.prepare(
    'SELECT * FROM owners WHERE id = ?'
  ).bind(ownerId).first() as any

  if (!owner) return c.json({ error: '用户不存在' }, 401)

  const valid = await verifyPassword(password, owner.password_hash)
  if (!valid) return c.json({ error: '密码错误' }, 401)

  // 生成简单 token 存入 KV（24小时有效）
  const token = generateId()
  await c.env.KV.put(`token:${token}`, ownerId, { expirationTtl: 86400 })

  return c.json({ token, owner: { id: owner.id, name: owner.name, ai_name: owner.ai_name } })
})

// ─── 主人：登出 ───────────────────────────────────────────────
apiRoutes.post('/owner/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (token) {
    await c.env.KV.delete(`token:${token}`)
    const ownerId = await c.env.KV.get(`token:${token}`)
    if (ownerId) await c.env.KV.delete(getOwnerOnlineKey(ownerId))
  }
  return c.json({ ok: true })
})

// ─── 主人：验证 token 中间件 ─────────────────────────────────
async function requireOwner(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const ownerId = await c.env.KV.get(`token:${token}`)
  if (!ownerId) return c.json({ error: 'Token expired' }, 401)

  c.set('ownerId', ownerId)
  await next()
}

// ─── 主人：获取自己的配置信息 ─────────────────────────────────
apiRoutes.get('/owner/me', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const owner = await c.env.DB.prepare(
    'SELECT id, name, bio, avatar, ai_name, ai_persona, email FROM owners WHERE id = ?'
  ).bind(ownerId).first()
  return c.json(owner)
})

// ─── 主人：更新个人资料和 AI 设置 ────────────────────────────
apiRoutes.put('/owner/profile', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const body = await c.req.json()
  const { name, bio, avatar, ai_name, ai_persona, email, password } = body

  let query = 'UPDATE owners SET name=?, bio=?, avatar=?, ai_name=?, ai_persona=?, email=?, updated_at=?'
  const params: any[] = [name, bio, avatar, ai_name, ai_persona, email, new Date().toISOString()]

  if (password) {
    const hash = await hashPassword(password)
    query += ', password_hash=?'
    params.push(hash)
  }

  query += ' WHERE id=?'
  params.push(ownerId)

  await c.env.DB.prepare(query).bind(...params).run()
  return c.json({ ok: true })
})

// ─── 主人：获取所有会话列表 ───────────────────────────────────
apiRoutes.get('/owner/sessions', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')

  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.visitor_name, s.status, s.created_at, s.updated_at,
           (SELECT content FROM messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message,
           (SELECT COUNT(*) FROM messages WHERE session_id = s.id AND role = 'visitor') as visitor_msg_count
    FROM sessions s
    WHERE s.owner_id = ?
    ORDER BY s.updated_at DESC
    LIMIT 50
  `).bind(ownerId).all()

  return c.json({ sessions: results })
})

// ─── 主人：心跳（保持在线状态）────────────────────────────────
apiRoutes.post('/owner/heartbeat', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  await c.env.KV.put(getOwnerOnlineKey(ownerId), 'true', { expirationTtl: 30 })
  return c.json({ ok: true })
})

// ─── 主人：主动回复某会话 ─────────────────────────────────────
apiRoutes.post('/owner/sessions/:sessionId/reply', requireOwner, async (c) => {
  const ownerId = c.get('ownerId')
  const sessionId = c.req.param('sessionId')
  const body = await c.req.json()
  const { content } = body

  if (!content?.trim()) return c.json({ error: 'Content required' }, 400)

  // 验证会话归属
  const session = await c.env.DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND owner_id = ?'
  ).bind(sessionId, ownerId).first()
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const msgId = generateId()
  const now = new Date().toISOString()
  await c.env.DB.prepare(
    'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(msgId, sessionId, 'owner', content.trim(), now).run()

  await c.env.DB.prepare(
    'UPDATE sessions SET updated_at = ?, status = "taken_over" WHERE id = ?'
  ).bind(now, sessionId).run()

  await c.env.KV.put(getSessionKey(sessionId), Date.now().toString(), { expirationTtl: 86400 * 7 })

  return c.json({ ok: true, messageId: msgId })
})

// ─── 轮询：获取会话最新时间戳（用于判断是否有新消息）─────────
apiRoutes.get('/sessions/:sessionId/ping', async (c) => {
  const sessionId = c.req.param('sessionId')
  const ts = await c.env.KV.get(getSessionKey(sessionId))
  return c.json({ ts: ts || '0' })
})
