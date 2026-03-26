// src/routes/owner.ts - 主人端后台
import { Hono } from 'hono'

type Bindings = { KV: KVNamespace }

export const ownerRoutes = new Hono<{ Bindings: Bindings }>()

// 登录页
ownerRoutes.get('/login', (c) => {
  return c.html(loginPage())
})

// 主人后台主页（需要前端 token 验证）
ownerRoutes.get('/dashboard', (c) => {
  return c.html(dashboardPage())
})

// 设置页
ownerRoutes.get('/settings', (c) => {
  return c.html(settingsPage())
})

// 注册页
ownerRoutes.get('/register', (c) => {
  return c.html(registerPage())
})

function loginPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>主人登录</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gray-900 flex items-center justify-center text-white">
<div class="w-full max-w-sm px-4">
  <div class="text-center mb-8">
    <div class="text-5xl mb-4">🔐</div>
    <h1 class="text-2xl font-bold">主人登录</h1>
    <p class="text-gray-400 text-sm mt-2">登录后管理你的 AI 分身</p>
  </div>
  
  <div class="bg-gray-800 rounded-2xl p-6 shadow-xl">
    <div id="errorMsg" class="hidden bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-4"></div>
    
    <div class="mb-4">
      <label class="block text-sm text-gray-400 mb-2">用户名</label>
      <input type="text" id="ownerId" placeholder="如：demo" 
        class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <div class="mb-6">
      <label class="block text-sm text-gray-400 mb-2">密码</label>
      <input type="password" id="password" placeholder="••••••••"
        class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <button onclick="doLogin()" id="loginBtn"
      class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition">
      登录
    </button>
    
    <div class="mt-4 text-center text-xs text-gray-600">
      Demo账号：用户名 <code class="bg-gray-700 px-1 py-0.5 rounded">demo</code>  
      密码 <code class="bg-gray-700 px-1 py-0.5 rounded">demo123</code>
    </div>
  </div>
  
  <div class="mt-6 text-center">
    <a href="/" class="text-gray-600 hover:text-gray-400 text-sm transition">← 返回首页</a>
  </div>
</div>

<script>
async function doLogin() {
  const ownerId = document.getElementById('ownerId').value.trim()
  const password = document.getElementById('password').value
  const btn = document.getElementById('loginBtn')
  const errEl = document.getElementById('errorMsg')
  
  if (!ownerId || !password) {
    showError('请输入用户名和密码')
    return
  }
  
  btn.disabled = true
  btn.textContent = '登录中...'
  errEl.classList.add('hidden')
  
  try {
    const resp = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId, password })
    })
    const data = await resp.json()
    
    if (!resp.ok) {
      showError(data.error || '登录失败')
      btn.disabled = false
      btn.textContent = '登录'
      return
    }
    
    localStorage.setItem('ownerToken', data.token)
    localStorage.setItem('ownerId', data.owner.id)
    localStorage.setItem('ownerName', data.owner.name)
    localStorage.setItem('aiName', data.owner.ai_name)
    
    window.location.href = '/owner/dashboard'
  } catch(e) {
    showError('网络错误，请重试')
    btn.disabled = false
    btn.textContent = '登录'
  }
}

function showError(msg) {
  const el = document.getElementById('errorMsg')
  el.textContent = msg
  el.classList.remove('hidden')
}

document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin()
})
</script>
</body>
</html>`
}

function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>我的对话 - 主人后台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { background: #0f0f0f; }
    .sidebar { width: 320px; min-width: 320px; }
    .chat-area { flex: 1; min-width: 0; }
    .messages-area { 
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .messages-area::-webkit-scrollbar { width: 4px; }
    .messages-area::-webkit-scrollbar-track { background: transparent; }
    .messages-area::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .msg-bubble { max-width: 72%; word-break: break-word; }
    /* Markdown 内容样式 */
    .md-content p { margin-bottom: 0.5em; }
    .md-content p:last-child { margin-bottom: 0; }
    .md-content ul, .md-content ol { padding-left: 1.4em; margin-bottom: 0.5em; }
    .md-content li { margin-bottom: 0.25em; }
    .md-content strong { font-weight: 600; color: #e2e8f0; }
    .md-content code { background: #1a1a2e; color: #90cdf4; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; font-family: monospace; }
    .md-content pre { background: #1a1a2e; border-radius: 8px; padding: 10px 14px; margin: 6px 0; overflow-x: auto; }
    .md-content pre code { background: none; padding: 0; }
    .md-content h1,.md-content h2,.md-content h3 { font-weight: 700; margin: 0.5em 0 0.3em; color: #e2e8f0; }
    .md-content blockquote { border-left: 3px solid #4a5568; padding-left: 10px; margin: 6px 0; color: #a0aec0; }
    .session-item:hover { background: rgba(255,255,255,0.05); }
    .session-item.active { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.4) !important; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @media (max-width: 768px) {
      .sidebar { width: 100%; min-width: 0; }
      .chat-area { display: none; }
      .chat-area.mobile-visible { display: flex; position: fixed; inset: 0; z-index: 50; background: #0f0f0f; }
    }
  </style>
</head>
<body class="text-white h-screen overflow-hidden flex flex-col">

<!-- 顶部导航 -->
<div class="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
  <div class="flex items-center gap-3">
    <button id="mobileBackBtn" class="hidden md:hidden text-gray-400 mr-2" onclick="closeMobileChat()">
      <i class="fas fa-arrow-left"></i>
    </button>
    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-sm" id="avatarEl">?</div>
    <div>
      <div class="font-semibold text-sm" id="ownerNameEl">加载中...</div>
      <div class="text-xs text-gray-500">主人后台</div>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-1.5 text-xs text-green-400">
      <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
      <span>在线中</span>
    </div>
    <a href="/owner/settings" class="text-gray-400 hover:text-white transition">
      <i class="fas fa-cog"></i>
    </a>
    <button onclick="doLogout()" class="text-gray-500 hover:text-white text-sm transition">
      <i class="fas fa-sign-out-alt"></i>
    </button>
  </div>
</div>

<!-- 主体：左右布局 -->
<div class="flex flex-1 overflow-hidden">
  
  <!-- 左侧：会话列表 -->
  <div class="sidebar flex flex-col border-r border-gray-800 bg-gray-900/50" id="sidebar">
    <div class="px-4 py-3 flex items-center justify-between">
      <h2 class="font-semibold text-sm text-gray-300">对话列表</h2>
      <button onclick="loadSessions()" class="text-gray-500 hover:text-gray-300 text-xs transition">
        <i class="fas fa-refresh"></i>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-2" id="sessionList">
      <div class="text-center text-gray-600 text-sm py-8">加载中...</div>
    </div>
  </div>
  
  <!-- 右侧：对话详情 -->
  <div class="chat-area flex-col" id="chatArea" style="display:none">
    
    <!-- 会话信息栏 -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/50 flex-shrink-0">
      <button class="md:hidden text-gray-400 mr-1" onclick="closeMobileChat()">
        <i class="fas fa-arrow-left"></i>
      </button>
      <div class="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm">👤</div>
      <div class="flex-1">
        <div class="font-semibold text-sm" id="currentVisitorName">访客</div>
        <div class="text-xs text-gray-500" id="currentSessionTime">-</div>
      </div>
      <div id="takenOverBadge" class="hidden text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">
        <i class="fas fa-user-check mr-1"></i>已接管
      </div>
      <button onclick="shareVisitorLink()" class="text-gray-500 hover:text-blue-400 text-sm transition" title="复制访客链接">
        <i class="fas fa-share-alt"></i>
      </button>
    </div>

    <!-- 消息区域 -->
    <div class="messages-area flex-1 px-4 py-4" id="ownerMessagesArea" style="height:calc(100vh - 220px)">
      <div class="text-center text-gray-600 text-sm py-12">
        <i class="fas fa-comments text-3xl mb-3 block text-gray-700"></i>
        选择左侧对话查看详情
      </div>
    </div>

    <!-- 回复区域 -->
    <div class="px-4 py-3 border-t border-gray-800 bg-gray-900/60 flex-shrink-0" id="replyArea">
      <div class="text-xs text-gray-500 mb-2 flex items-center gap-2">
        <i class="fas fa-pen-to-square text-emerald-500"></i>
        <span>以本人身份回复（访客会看到"本人"标签）</span>
      </div>
      <div class="flex gap-2">
        <textarea id="ownerReplyInput" 
          placeholder="输入回复内容..."
          rows="2"
          class="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-emerald-500 transition resize-none placeholder-gray-500"
          style="max-height:100px;overflow-y:auto"
        ></textarea>
        <button id="ownerSendBtn" onclick="sendOwnerReply()"
          class="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white w-11 rounded-xl flex items-center justify-center transition flex-shrink-0 self-end h-11">
          <i class="fas fa-paper-plane text-sm"></i>
        </button>
      </div>
    </div>
  </div>

  <!-- 右侧空状态 -->
  <div class="chat-area flex-col items-center justify-center" id="emptyChatArea" style="display:flex">
    <div class="text-gray-600 text-center">
      <i class="fas fa-comments text-5xl mb-4 block"></i>
      <p class="text-sm">选择左侧对话开始查看</p>
      <p class="text-xs mt-2 text-gray-700">你的 AI 分身正在替你接待访客</p>
    </div>
  </div>

</div>

<script>
const token = localStorage.getItem('ownerToken')
const ownerId = localStorage.getItem('ownerId')
const ownerName = localStorage.getItem('ownerName')
const aiName = localStorage.getItem('aiName')

if (!token) {
  window.location.href = '/owner/login'
}

document.getElementById('ownerNameEl').textContent = ownerName || '主人'

let currentSessionId = null
let heartbeatTimer = null
let pollTimer = null
let lastMsgTs = '0'
let sessionsData = []
const renderedOwnerIds = new Set()

// ─── 心跳：保持在线状态 ───────────────
function startHeartbeat() {
  sendHeartbeat()
  heartbeatTimer = setInterval(sendHeartbeat, 20000)
}

async function sendHeartbeat() {
  try {
    await fetch('/api/owner/heartbeat', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    })
  } catch(e) {}
}

// ─── 加载会话列表 ─────────────────────
async function loadSessions() {
  try {
    const resp = await fetch('/api/owner/sessions', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (resp.status === 401) {
      window.location.href = '/owner/login'
      return
    }
    const data = await resp.json()
    sessionsData = data.sessions || []
    renderSessionList()
  } catch(e) {}
}

function renderSessionList() {
  const list = document.getElementById('sessionList')
  if (sessionsData.length === 0) {
    list.innerHTML = '<div class="text-center text-gray-600 text-sm py-8"><i class="fas fa-inbox text-2xl block mb-2 text-gray-700"></i>暂无对话</div>'
    return
  }

  list.innerHTML = sessionsData.map(s => {
    const time = new Date(s.updated_at).toLocaleString('zh-CN', { 
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })
    const name = s.visitor_name || '匿名访客'
    const lastMsg = s.last_message ? (s.last_message.length > 30 ? s.last_message.slice(0,30)+'...' : s.last_message) : '暂无消息'
    const isActive = s.id === currentSessionId
    const statusColor = s.status === 'taken_over' ? 'text-emerald-400' : 'text-gray-500'
    const statusIcon = s.status === 'taken_over' ? 'fa-user-check' : 'fa-robot'
    
    return \`<div class="session-item cursor-pointer rounded-xl px-3 py-3 mb-1 border border-transparent \${isActive ? 'active' : ''}" 
      onclick="openSession('\${s.id}', '\${escHtml(name)}', '\${escHtml(s.created_at)}', '\${s.status}')">
      <div class="flex items-center gap-2 mb-1">
        <span class="font-medium text-sm text-white flex-1 truncate">\${escHtml(name)}</span>
        <span class="text-xs text-gray-600 flex-shrink-0">\${time}</span>
      </div>
      <div class="text-xs text-gray-500 truncate flex items-center gap-1.5">
        <i class="fas \${statusIcon} \${statusColor} text-xs"></i>
        <span>\${escHtml(lastMsg)}</span>
      </div>
    </div>\`
  }).join('')
}

// ─── 打开某个会话 ─────────────────────
async function openSession(sessionId, visitorName, createdAt, status) {
  currentSessionId = sessionId
  lastMsgTs = '0'

  document.getElementById('currentVisitorName').textContent = visitorName
  document.getElementById('currentSessionTime').textContent = new Date(createdAt).toLocaleString('zh-CN')
  
  const badge = document.getElementById('takenOverBadge')
  if (status === 'taken_over') badge.classList.remove('hidden')
  else badge.classList.add('hidden')

  // 显示聊天区域
  document.getElementById('chatArea').style.display = 'flex'
  document.getElementById('emptyChatArea').style.display = 'none'

  // 移动端
  document.getElementById('chatArea').classList.add('mobile-visible')

  renderSessionList() // 刷新选中状态

  // 加载历史消息
  const area = document.getElementById('ownerMessagesArea')
  area.innerHTML = '<div class="text-center text-gray-600 text-sm py-8">加载中...</div>'

  try {
    const resp = await fetch('/api/sessions/' + sessionId + '/messages')
    const data = await resp.json()
    
    area.innerHTML = ''
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(m => {
        appendOwnerMessage(m.role, m.content, m.created_at, m.id)
        lastMsgTs = m.created_at
      })
    } else {
      area.innerHTML = '<div class="text-center text-gray-600 text-sm py-8">暂无消息</div>'
    }
    area.scrollTop = area.scrollHeight
  } catch(e) {
    area.innerHTML = '<div class="text-center text-red-500 text-sm py-8">加载失败</div>'
  }

  // 开始轮询此会话新消息
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(pollNewMessages, 2500)
}

function closeMobileChat() {
  document.getElementById('chatArea').classList.remove('mobile-visible')
}

// ─── 轮询新消息 ───────────────────────
async function pollNewMessages() {
  if (!currentSessionId) return
  try {
    const resp = await fetch('/api/sessions/' + currentSessionId + '/messages?since=' + encodeURIComponent(lastMsgTs))
    const data = await resp.json()
    
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(m => {
        appendOwnerMessage(m.role, m.content, m.created_at, m.id)
        lastMsgTs = m.created_at
      })
      const area = document.getElementById('ownerMessagesArea')
      area.scrollTop = area.scrollHeight
      // 刷新列表
      loadSessions()
    }
  } catch(e) {}
}

// ─── 渲染消息 ─────────────────────────
function appendOwnerMessage(role, content, time, id) {
  if (id) {
    if (renderedOwnerIds.has(id)) return
    renderedOwnerIds.add(id)
  }
  const area = document.getElementById('ownerMessagesArea')
  const isVisitor = role === 'visitor'
  const isOwner = role === 'owner'

  const div = document.createElement('div')
  div.className = 'flex items-start gap-3 mb-4 fade-in ' + (isVisitor ? 'flex-row-reverse' : '')

  const timeStr = new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  
  const avatar = isVisitor ? '👤' : (isOwner ? '🧑' : '🤖')
  const avatarBg = isVisitor ? 'bg-gray-700' : (isOwner ? 'bg-emerald-700' : 'bg-gradient-to-br from-blue-500 to-purple-600')
  const bubbleClass = isVisitor 
    ? 'bg-gray-700 text-white rounded-2xl rounded-tr-sm'
    : isOwner
      ? 'bg-emerald-800/60 text-gray-100 rounded-2xl rounded-tl-sm border border-emerald-700/40'
      : 'bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'
  const label = isVisitor ? '访客' : (isOwner ? '<span class="text-emerald-400">本人</span>' : (aiName || 'AI'))

  const bodyHtml = isVisitor ? escHtml(content) : renderMdOwner(content)
  const mdClass = isVisitor ? '' : ' md-content'

  div.innerHTML = isVisitor ? \`
    <div>
      <div class="msg-bubble \${bubbleClass} px-4 py-3 text-sm leading-relaxed">\${bodyHtml}</div>
      <div class="text-xs text-gray-600 mt-1 text-right pr-1">\${label} · \${timeStr}</div>
    </div>
    <div class="w-8 h-8 rounded-full \${avatarBg} flex items-center justify-center text-sm flex-shrink-0">\${avatar}</div>
  \` : \`
    <div class="w-8 h-8 rounded-full \${avatarBg} flex items-center justify-center text-sm flex-shrink-0">\${avatar}</div>
    <div>
      <div class="msg-bubble\${mdClass} \${bubbleClass} px-4 py-3 text-sm leading-relaxed">\${bodyHtml}</div>
      <div class="text-xs text-gray-600 mt-1 pl-1">\${label} · \${timeStr}</div>
    </div>
  \`

  area.appendChild(div)
}

// ─── 主人发送回复 ─────────────────────
async function sendOwnerReply() {
  if (!currentSessionId) return
  const input = document.getElementById('ownerReplyInput')
  const content = input.value.trim()
  if (!content) return

  document.getElementById('ownerSendBtn').disabled = true
  input.value = ''

  try {
    const resp = await fetch('/api/owner/sessions/' + currentSessionId + '/reply', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    })
    
    if (resp.ok) {
      const data = await resp.json()
      const now = new Date().toISOString()
      appendOwnerMessage('owner', content, now, data.messageId)
      document.getElementById('ownerMessagesArea').scrollTop = 99999
      document.getElementById('takenOverBadge').classList.remove('hidden')
      loadSessions()
    }
  } catch(e) {}

  document.getElementById('ownerSendBtn').disabled = false
  input.focus()
}

function shareVisitorLink() {
  const url = window.location.origin + '/u/' + ownerId
  navigator.clipboard.writeText(url).then(() => {
    alert('已复制访客链接：' + url)
  }).catch(() => {
    prompt('复制访客链接：', url)
  })
}

async function doLogout() {
  await fetch('/api/owner/logout', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token }
  })
  localStorage.clear()
  window.location.href = '/owner/login'
}

function escHtml(text) {
  if (!text) return ''
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')
}

// Markdown 渲染（AI/owner 消息专用）
function renderMdOwner(text) {
  try {
    if (typeof marked !== 'undefined') {
      return marked.parse(String(text || ''))
    }
  } catch(e) {}
  return escHtml(text)
}

// Enter 发送
document.getElementById('ownerReplyInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendOwnerReply()
  }
})

// ─── 初始化 ───────────────────────────
startHeartbeat()
loadSessions()
// 定时刷新会话列表
setInterval(loadSessions, 10000)
</script>
</body>
</html>`
}

function settingsPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>设置 - 主人后台</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="min-h-screen bg-gray-900 text-white">

<div class="max-w-2xl mx-auto px-4 py-8">
  <!-- 顶部 -->
  <div class="flex items-center gap-4 mb-8">
    <a href="/owner/dashboard" class="text-gray-400 hover:text-white transition">
      <i class="fas fa-arrow-left text-lg"></i>
    </a>
    <h1 class="text-xl font-bold">个人设置</h1>
  </div>

  <div id="successMsg" class="hidden bg-emerald-900/50 border border-emerald-700 text-emerald-300 text-sm rounded-xl px-4 py-3 mb-6">
    <i class="fas fa-check-circle mr-2"></i>保存成功！
  </div>
  <div id="errorMsg" class="hidden bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-6"></div>

  <!-- 表单 -->
  <div class="space-y-6">
    <!-- 基本信息 -->
    <div class="bg-gray-800 rounded-2xl p-6">
      <h2 class="font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <i class="fas fa-user text-blue-400"></i> 基本信息
      </h2>
      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm text-gray-400 mb-2">显示名称</label>
          <input type="text" id="name" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition" placeholder="你的名字">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-2">头像（emoji）</label>
          <input type="text" id="avatar" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition text-2xl" placeholder="🚀" maxlength="2">
        </div>
      </div>
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-2">个人简介</label>
        <textarea id="bio" rows="2" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition resize-none" placeholder="一句话介绍自己..."></textarea>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-2">联系邮箱</label>
        <input type="email" id="email" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition" placeholder="your@email.com">
      </div>
    </div>

    <!-- AI 分身设置 -->
    <div class="bg-gray-800 rounded-2xl p-6">
      <h2 class="font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <i class="fas fa-robot text-purple-400"></i> AI 分身设置
      </h2>
      <div class="mb-4">
        <label class="block text-sm text-gray-400 mb-2">AI 分身名字</label>
        <input type="text" id="ai_name" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition" placeholder="如：Tara、小助手">
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-2">AI 人设 / 系统提示词</label>
        <p class="text-xs text-gray-600 mb-2">告诉 AI 它是谁、你做什么、怎么回答问题、哪些问题需要转给你</p>
        <textarea id="ai_persona" rows="6" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition resize-none text-sm leading-relaxed font-mono" placeholder="你是 [你的名字] 的 AI 分身，名叫 [AI名字]。你的工作是..."></textarea>
      </div>
    </div>

    <!-- 访客链接 -->
    <div class="bg-gray-800 rounded-2xl p-6">
      <h2 class="font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <i class="fas fa-link text-green-400"></i> 访客链接
      </h2>
      <div class="flex items-center gap-3 bg-gray-700/50 rounded-xl px-4 py-3">
        <div class="flex-1 text-sm text-blue-400 font-mono" id="visitorLinkDisplay">加载中...</div>
        <button onclick="copyLink()" class="text-gray-400 hover:text-white transition text-sm">
          <i class="fas fa-copy"></i>
        </button>
      </div>
      <p class="text-xs text-gray-600 mt-2">把这个链接分享给别人，他们就能和你的 AI 分身聊天</p>
    </div>

    <!-- 修改密码 -->
    <div class="bg-gray-800 rounded-2xl p-6">
      <h2 class="font-semibold mb-4 text-gray-200 flex items-center gap-2">
        <i class="fas fa-lock text-yellow-400"></i> 修改密码（可选）
      </h2>
      <input type="password" id="newPassword" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-yellow-500 transition" placeholder="留空则不修改">
    </div>

    <button onclick="saveSettings()" id="saveBtn"
      class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3.5 font-semibold transition">
      <i class="fas fa-save mr-2"></i>保存设置
    </button>
  </div>
</div>

<script>
const token = localStorage.getItem('ownerToken')
if (!token) window.location.href = '/owner/login'

async function loadSettings() {
  try {
    const resp = await fetch('/api/owner/me', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    if (resp.status === 401) { window.location.href = '/owner/login'; return }
    const owner = await resp.json()
    
    document.getElementById('name').value = owner.name || ''
    document.getElementById('bio').value = owner.bio || ''
    document.getElementById('avatar').value = owner.avatar || ''
    document.getElementById('ai_name').value = owner.ai_name || ''
    document.getElementById('ai_persona').value = owner.ai_persona || ''
    document.getElementById('email').value = owner.email || ''
    
    const link = window.location.origin + '/u/' + owner.id
    document.getElementById('visitorLinkDisplay').textContent = link
  } catch(e) {}
}

async function saveSettings() {
  const btn = document.getElementById('saveBtn')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>保存中...'
  
  document.getElementById('successMsg').classList.add('hidden')
  document.getElementById('errorMsg').classList.add('hidden')

  try {
    const resp = await fetch('/api/owner/profile', {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: document.getElementById('name').value,
        bio: document.getElementById('bio').value,
        avatar: document.getElementById('avatar').value,
        ai_name: document.getElementById('ai_name').value,
        ai_persona: document.getElementById('ai_persona').value,
        email: document.getElementById('email').value,
        password: document.getElementById('newPassword').value || undefined
      })
    })
    
    if (resp.ok) {
      document.getElementById('successMsg').classList.remove('hidden')
      document.getElementById('newPassword').value = ''
      localStorage.setItem('ownerName', document.getElementById('name').value)
      localStorage.setItem('aiName', document.getElementById('ai_name').value)
      window.scrollTo(0, 0)
    } else {
      const d = await resp.json()
      const el = document.getElementById('errorMsg')
      el.textContent = d.error || '保存失败'
      el.classList.remove('hidden')
    }
  } catch(e) {
    const el = document.getElementById('errorMsg')
    el.textContent = '网络错误，请重试'
    el.classList.remove('hidden')
  }

  btn.disabled = false
  btn.innerHTML = '<i class="fas fa-save mr-2"></i>保存设置'
}

function copyLink() {
  const link = document.getElementById('visitorLinkDisplay').textContent
  navigator.clipboard.writeText(link).then(() => {
    alert('链接已复制！')
  }).catch(() => {
    prompt('复制链接：', link)
  })
}

loadSettings()
</script>
</body>
</html>`
}

function registerPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>注册账号</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-900 flex items-center justify-center text-white">
<div class="w-full max-w-sm px-4">
  <div class="text-center mb-8">
    <div class="text-5xl mb-4">🤖</div>
    <h1 class="text-2xl font-bold">创建你的 AI 分身</h1>
    <p class="text-gray-400 text-sm mt-2">注册后获得专属访客链接</p>
  </div>
  <div class="bg-gray-800 rounded-2xl p-6 shadow-xl">
    <div id="errorMsg" class="hidden bg-red-900/50 border border-red-700 text-red-300 text-sm rounded-xl px-4 py-3 mb-4"></div>
    <div class="mb-4">
      <label class="block text-sm text-gray-400 mb-2">用户名 <span class="text-gray-600 text-xs">（只能用小写字母/数字/_/-）</span></label>
      <input type="text" id="userId" placeholder="如：yourname" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <div class="mb-4">
      <label class="block text-sm text-gray-400 mb-2">显示名称</label>
      <input type="text" id="userName" placeholder="如：张三" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <div class="mb-4">
      <label class="block text-sm text-gray-400 mb-2">登录密码</label>
      <input type="password" id="password" placeholder="••••••••" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <div class="mb-6">
      <label class="block text-sm text-gray-400 mb-2">邀请码</label>
      <input type="text" id="inviteCode" placeholder="请输入邀请码" class="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none border border-gray-600 focus:border-blue-500 transition placeholder-gray-500">
    </div>
    <button onclick="doRegister()" id="regBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition">
      创建账号
    </button>
  </div>
  <div class="mt-4 text-center">
    <a href="/owner/login" class="text-gray-600 hover:text-gray-400 text-sm transition">已有账号？去登录 →</a>
  </div>
</div>
<script>
async function doRegister() {
  const id = document.getElementById('userId').value.trim().toLowerCase()
  const name = document.getElementById('userName').value.trim()
  const password = document.getElementById('password').value
  const invite_code = document.getElementById('inviteCode').value.trim()
  const btn = document.getElementById('regBtn')
  const errEl = document.getElementById('errorMsg')
  errEl.classList.add('hidden')
  if (!id || !name || !password || !invite_code) { showErr('请填写所有字段'); return }
  btn.disabled = true; btn.textContent = '注册中...'
  try {
    const resp = await fetch('/api/owner/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, password, invite_code })
    })
    const data = await resp.json()
    if (!resp.ok) { showErr(data.error || '注册失败'); btn.disabled=false; btn.textContent='创建账号'; return }
    alert('注册成功！请登录')
    window.location.href = '/owner/login'
  } catch(e) { showErr('网络错误'); btn.disabled=false; btn.textContent='创建账号' }
}
function showErr(msg) {
  const el = document.getElementById('errorMsg')
  el.textContent = msg; el.classList.remove('hidden')
}
</script>
</body>
</html>`
}
