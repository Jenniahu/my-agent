// src/routes/visitor.ts - 访客端页面
import { Hono } from 'hono'

type Bindings = { KV: KVNamespace }

export const visitorRoutes = new Hono<{ Bindings: Bindings }>()

// 首页：引导访客去某个主人的主页
visitorRoutes.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI 分身平台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
  <div class="text-center text-white">
    <div class="text-6xl mb-6">🤖</div>
    <h1 class="text-3xl font-bold mb-4">AI 分身平台</h1>
    <p class="text-gray-400 mb-8">访问 <code class="bg-gray-700 px-2 py-1 rounded text-sm">/u/用户名</code> 与 TA 的 AI 分身对话</p>
    <a href="/u/demo" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition">
      试试 Demo 演示
    </a>
    <div class="mt-6">
      <a href="/owner/login" class="text-gray-500 hover:text-gray-300 text-sm transition">
        主人登录 →
      </a>
    </div>
  </div>
</body>
</html>`)
})

// 访客主页：/u/:ownerId
visitorRoutes.get('/u/:ownerId', async (c) => {
  const ownerId = c.req.param('ownerId')
  const data = await c.env.KV.get(`owner:${ownerId}`)
  const owner = data ? JSON.parse(data) : null

  if (!owner) {
    return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>404</title><script src="https://cdn.tailwindcss.com"></script></head>
<body class="min-h-screen bg-gray-900 flex items-center justify-center text-white">
  <div class="text-center">
    <div class="text-5xl mb-4">😔</div>
    <h1 class="text-2xl font-bold">找不到这个用户</h1>
    <a href="/" class="mt-4 text-blue-400 hover:text-blue-300 block">← 返回首页</a>
  </div>
</body>
</html>`, 404)
  }

  return c.html(visitorChatPage(owner))
})

function visitorChatPage(owner: any): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>和 ${owner.ai_name} 聊天 · ${owner.name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { background: #0f0f0f; }
    .chat-container { height: calc(100vh - 0px); max-width: 780px; margin: 0 auto; }
    .messages-area { 
      height: calc(100% - 140px);
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .messages-area::-webkit-scrollbar { width: 4px; }
    .messages-area::-webkit-scrollbar-track { background: transparent; }
    .messages-area::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .msg-bubble { max-width: 72%; word-break: break-word; }
    .typing-dot { animation: bounce 1.2s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  </style>
</head>
<body class="text-white">

<div class="chat-container w-full flex flex-col" id="app">
  
  <!-- 顶部信息栏 -->
  <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold shadow-lg">
      ${owner.avatar || owner.name.charAt(0)}
    </div>
    <div class="flex-1">
      <div class="font-semibold text-white flex items-center gap-2">
        <span id="chatTitle">和 ${owner.ai_name} 聊天</span>
        <span id="ownerOnlineBadge" class="hidden text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
          <i class="fas fa-circle text-xs mr-1"></i>本人在线
        </span>
      </div>
      <div class="text-xs text-gray-400">${owner.name} 可查看该对话，也可能用 ${owner.ai_name} 回复你</div>
    </div>
  </div>

  <!-- 消息区域 -->
  <div class="messages-area px-4 py-4 flex-1" id="messagesArea">
    <!-- 欢迎消息 -->
    <div class="flex items-start gap-3 mb-4 fade-in">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">
        🤖
      </div>
      <div>
        <div class="msg-bubble bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
          你好！我是 ${owner.ai_name}，${owner.name} 的 AI 分身。<br>
          <span class="text-gray-400 text-xs">${owner.bio || '有什么我可以帮你的吗？'}</span>
        </div>
        <div class="text-xs text-gray-600 mt-1 pl-1">${owner.ai_name}</div>
      </div>
    </div>
  </div>

  <!-- 输入区域 -->
  <div class="px-4 py-3 border-t border-gray-800 bg-gray-900/60 backdrop-blur">
    <div id="visitorNameSection" class="mb-3">
      <input type="text" id="visitorNameInput" 
        placeholder="你的名字（可选）" 
        class="w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-2 outline-none border border-gray-700 focus:border-blue-500 transition placeholder-gray-500"
        maxlength="30">
    </div>
    <div class="flex gap-2">
      <textarea id="messageInput" 
        placeholder="发消息给 ${owner.ai_name}..." 
        rows="1"
        class="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-blue-500 transition resize-none placeholder-gray-500 leading-relaxed"
        style="min-height:44px;max-height:120px;overflow-y:auto"
      ></textarea>
      <button id="sendBtn" 
        class="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white w-11 h-11 rounded-xl flex items-center justify-center transition flex-shrink-0"
        onclick="sendMessage()">
        <i class="fas fa-paper-plane text-sm"></i>
      </button>
    </div>
    <div class="text-xs text-gray-600 mt-2 text-center">
      内测版 · 仅支持文字对话
    </div>
  </div>

</div>

<script>
const OWNER_ID = '${owner.id}'
const AI_NAME = '${owner.ai_name}'
let sessionId = null
let lastTs = '0'
let pollTimer = null
let isWaiting = false
const renderedIds = new Set() // 已渲染消息 ID，防止重复

// 自动调整 textarea 高度
const textarea = document.getElementById('messageInput')
textarea.addEventListener('input', function() {
  this.style.height = 'auto'
  this.style.height = Math.min(this.scrollHeight, 120) + 'px'
})

// Enter 发送（Shift+Enter 换行）
textarea.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

async function initSession() {
  const visitorName = document.getElementById('visitorNameInput').value.trim()
  const resp = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId: OWNER_ID, visitorName: visitorName || null })
  })
  const data = await resp.json()
  sessionId = data.sessionId

  // 隐藏名字输入
  document.getElementById('visitorNameSection').style.display = 'none'

  // 开始轮询
  startPolling()
  return sessionId
}

async function sendMessage() {
  if (isWaiting) return
  const input = document.getElementById('messageInput')
  const content = input.value.trim()
  if (!content) return

  // 第一次发消息，先创建会话
  if (!sessionId) {
    await initSession()
  }

  input.value = ''
  input.style.height = 'auto'
  document.getElementById('sendBtn').disabled = true
  isWaiting = true

  // 先不渲染访客消息，等 API 返回带 ID 后再渲染，避免轮询重复

  // 显示 typing 指示器
  showTyping()

  try {
    const resp = await fetch('/api/sessions/' + sessionId + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    const data = await resp.json()

    hideTyping()

    // 渲染访客消息（带 ID，轮询不会重复）
    appendMessage('visitor', content, data.visitorMessageId)

    if (data.ownerOnline) {
      appendSystemMsg('本人正在查看，稍等回复...')
    } else if (data.aiReply) {
      appendMessage('ai', data.aiReply.content, data.aiReply.id)
    }
  } catch(e) {
    hideTyping()
    appendSystemMsg('发送失败，请重试')
  }

  isWaiting = false
  document.getElementById('sendBtn').disabled = false
  document.getElementById('messageInput').focus()
}

function appendMessage(role, content, id) {
  // 有 ID 时做去重，防止轮询和直接渲染重复
  if (id) {
    if (renderedIds.has(id)) return
    renderedIds.add(id)
  }
  const area = document.getElementById('messagesArea')
  const isVisitor = role === 'visitor'
  const isOwner = role === 'owner'

  const div = document.createElement('div')
  div.className = 'flex items-start gap-3 mb-4 fade-in ' + (isVisitor ? 'flex-row-reverse' : '')
  div.dataset.msgId = id || ''

  const avatar = isVisitor ? '' : (isOwner ? '👤' : '🤖')
  const bubbleClass = isVisitor 
    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
    : isOwner
      ? 'bg-emerald-800/60 text-gray-100 rounded-2xl rounded-tl-sm border border-emerald-700/40'
      : 'bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'

  const label = isVisitor ? '' : (isOwner ? '<div class="text-xs text-gray-500 mt-1 pl-1">本人</div>' : '<div class="text-xs text-gray-600 mt-1 pl-1">' + AI_NAME + '</div>')

  div.innerHTML = isVisitor ? \`
    <div>
      <div class="msg-bubble \${bubbleClass} px-4 py-3 text-sm leading-relaxed">\${escapeHtml(content)}</div>
    </div>
  \` : \`
    <div class="w-8 h-8 rounded-full \${isOwner ? 'bg-emerald-700' : 'bg-gradient-to-br from-blue-500 to-purple-600'} flex items-center justify-center text-sm flex-shrink-0">\${avatar}</div>
    <div>
      <div class="msg-bubble \${bubbleClass} px-4 py-3 text-sm leading-relaxed">\${escapeHtml(content)}</div>
      \${label}
    </div>
  \`

  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function appendSystemMsg(text) {
  const area = document.getElementById('messagesArea')
  const div = document.createElement('div')
  div.className = 'text-center text-xs text-gray-600 my-2 fade-in'
  div.textContent = text
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function showTyping() {
  const area = document.getElementById('messagesArea')
  const div = document.createElement('div')
  div.id = 'typingIndicator'
  div.className = 'flex items-start gap-3 mb-4'
  div.innerHTML = \`
    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
    <div class="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
      <span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
      <span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
      <span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>
    </div>
  \`
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function hideTyping() {
  const el = document.getElementById('typingIndicator')
  if (el) el.remove()
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')
}

// 轮询新消息（主人回复时用）
function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (!sessionId) return
    try {
      const resp = await fetch('/api/sessions/' + sessionId + '/messages?since=' + lastTs)
      const data = await resp.json()

      if (data.session) {
        // 更新主人在线状态
        const badge = document.getElementById('ownerOnlineBadge')
        if (data.session.is_owner_online) {
          badge.classList.remove('hidden')
        } else {
          badge.classList.add('hidden')
        }
      }

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          // 统一用 ID 去重，owner 和 ai 消息都走这里
          appendMessage(msg.role, msg.content, msg.id)
          lastTs = msg.created_at
        })
      }
    } catch(e) {}
  }, 2000)
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>
</body>
</html>`
}
