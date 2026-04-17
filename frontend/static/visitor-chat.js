// visitor-chat.js - 访客聊天页逻辑
// OWNER_ID 和 AI_NAME 由内联 <script> 注入到 window 上

let sessionId = null
let lastTs = '0'
let pollTimer = null
let isWaiting = false
let currentAbortId = null
const renderedIds = new Set()

// 访客用户状态
let visitorToken = localStorage.getItem('visitor_token')
let visitorInfo = null

// 获取访客信息
async function loadVisitorInfo() {
  if (!visitorToken) return
  try {
    const resp = await fetch('/api/visitor/profile', {
      headers: { 'Authorization': 'Bearer ' + visitorToken }
    })
    if (resp.ok) {
      const data = await resp.json()
      visitorInfo = data.visitor
      updateVisitorUI()
    } else {
      // token 失效
      localStorage.removeItem('visitor_token')
      visitorToken = null
    }
  } catch(e) {}
}

// 更新访客 UI 显示
function updateVisitorUI() {
  const authSection = document.getElementById('visitorAuthSection')
  const userSection = document.getElementById('visitorUserSection')
  if (visitorInfo) {
    if (authSection) authSection.style.display = 'none'
    if (userSection) {
      userSection.style.display = 'flex'
      const nameEl = document.getElementById('visitorDisplayName')
      if (nameEl) nameEl.textContent = visitorInfo.name || visitorInfo.email
    }
  } else {
    if (authSection) authSection.style.display = 'block'
    if (userSection) userSection.style.display = 'none'
  }
}

// 显示登录弹窗
function showAuthModal() {
  const modal = document.getElementById('authModal')
  if (modal) modal.classList.remove('hidden')
}

// 隐藏登录弹窗
function hideAuthModal() {
  const modal = document.getElementById('authModal')
  if (modal) modal.classList.add('hidden')
}

// 切换登录/注册标签
function switchAuthTab(tab) {
  const loginTab = document.getElementById('loginTab')
  const registerTab = document.getElementById('registerTab')
  const loginForm = document.getElementById('loginForm')
  const registerForm = document.getElementById('registerForm')
  
  if (tab === 'login') {
    loginTab.classList.add('text-blue-400', 'border-b-2', 'border-blue-400')
    loginTab.classList.remove('text-gray-400')
    registerTab.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400')
    registerTab.classList.add('text-gray-400')
    loginForm.classList.remove('hidden')
    registerForm.classList.add('hidden')
  } else {
    registerTab.classList.add('text-blue-400', 'border-b-2', 'border-blue-400')
    registerTab.classList.remove('text-gray-400')
    loginTab.classList.remove('text-blue-400', 'border-b-2', 'border-blue-400')
    loginTab.classList.add('text-gray-400')
    registerForm.classList.remove('hidden')
    loginForm.classList.add('hidden')
  }
}

// 访客登录
async function visitorLogin() {
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  const errorEl = document.getElementById('loginError')
  
  if (!email || !password) {
    errorEl.textContent = '请填写邮箱和密码'
    return
  }
  
  try {
    const resp = await fetch('/api/visitor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await resp.json()
    
    if (data.success) {
      visitorToken = data.token
      visitorInfo = data.visitor
      localStorage.setItem('visitor_token', visitorToken)
      hideAuthModal()
      updateVisitorUI()
      errorEl.textContent = ''
      // 刷新页面以使用登录状态创建会话
      location.reload()
    } else {
      errorEl.textContent = data.error || '登录失败'
    }
  } catch(e) {
    errorEl.textContent = '网络错误'
  }
}

// 访客注册
async function visitorRegister() {
  const email = document.getElementById('registerEmail').value.trim()
  const password = document.getElementById('registerPassword').value
  const name = document.getElementById('registerName').value.trim()
  const errorEl = document.getElementById('registerError')
  
  if (!email || !password) {
    errorEl.textContent = '请填写邮箱和密码'
    return
  }
  
  try {
    const resp = await fetch('/api/visitor/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    })
    const data = await resp.json()
    
    if (data.success) {
      // 注册成功，自动登录
      await visitorLogin()
    } else {
      errorEl.textContent = data.error || '注册失败'
    }
  } catch(e) {
    errorEl.textContent = '网络错误'
  }
}

// 访客退出
function visitorLogout() {
  localStorage.removeItem('visitor_token')
  visitorToken = null
  visitorInfo = null
  updateVisitorUI()
  location.reload()
}

// 显示会话历史弹窗
async function showSessionsModal() {
  if (!visitorToken) {
    showAuthModal()
    return
  }
  
  const modal = document.getElementById('sessionsModal')
  const listEl = document.getElementById('sessionsList')
  
  try {
    const resp = await fetch('/api/visitor/sessions', {
      headers: { 'Authorization': 'Bearer ' + visitorToken }
    })
    const data = await resp.json()
    
    if (data.sessions && data.sessions.length > 0) {
      listEl.innerHTML = data.sessions.map(s => `
        <div class="bg-gray-800 rounded-lg p-3 mb-2 flex items-center justify-between">
          <div class="flex-1 cursor-pointer" onclick="switchSession('${s.id}')">
            <div class="text-sm font-medium text-white">与 ${s.owner.ai_name} 的对话</div>
            <div class="text-xs text-gray-400">${new Date(s.updated_at).toLocaleString()}</div>
            <div class="text-xs text-gray-500 mt-1 truncate">${s.preview || '无消息'}</div>
          </div>
          <button onclick="deleteSession('${s.id}')" class="ml-2 text-red-400 hover:text-red-300 p-2">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `).join('')
    } else {
      listEl.innerHTML = '<div class="text-center text-gray-500 py-8">暂无历史会话</div>'
    }
    
    modal.classList.remove('hidden')
  } catch(e) {
    alert('加载会话列表失败')
  }
}

// 隐藏会话历史弹窗
function hideSessionsModal() {
  const modal = document.getElementById('sessionsModal')
  if (modal) modal.classList.add('hidden')
}

// 切换到指定会话
function switchSession(newSessionId) {
  localStorage.setItem('session_' + window.OWNER_ID, newSessionId)
  hideSessionsModal()
  location.reload()
}

// 删除会话
async function deleteSession(sessionIdToDelete) {
  if (!confirm('确定要删除这个会话吗？')) return
  
  try {
    const resp = await fetch('/api/visitor/sessions/' + sessionIdToDelete, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + visitorToken }
    })
    
    if (resp.ok) {
      // 如果删除的是当前会话，清除本地存储
      const currentSaved = localStorage.getItem('session_' + window.OWNER_ID)
      if (currentSaved === sessionIdToDelete) {
        localStorage.removeItem('session_' + window.OWNER_ID)
      }
      showSessionsModal() // 刷新列表
    } else {
      alert('删除失败')
    }
  } catch(e) {
    alert('删除失败')
  }
}

// ── 工具函数（不依赖 DOM，可在顶层定义）──────────────────

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n').join('<br>')
}

function renderMd(text) {
  try {
    if (typeof marked !== 'undefined') {
      // marked v9+ 使用 marked.parse，选项通过第二参数传入
      return marked.parse(String(text), { breaks: true, gfm: true })
    }
  } catch(e) {}
  return escapeHtml(text)
}

function appendSystemMsg(text) {
  const area = document.getElementById('messagesArea')
  if (!area) return
  const div = document.createElement('div')
  div.className = 'text-center text-xs text-gray-600 my-2 fade-in'
  div.textContent = text
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function showTyping() {
  const area = document.getElementById('messagesArea')
  if (!area) return
  const div = document.createElement('div')
  div.id = 'typingIndicator'
  div.className = 'flex items-start gap-3 mb-4'
  div.innerHTML =
    '<div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">🤖</div>' +
    '<div class="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">' +
    '<span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>' +
    '<span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>' +
    '<span class="typing-dot w-2 h-2 bg-gray-400 rounded-full inline-block"></span>' +
    '</div>'
  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function hideTyping() {
  const el = document.getElementById('typingIndicator')
  if (el) el.remove()
}

function appendMessage(role, content, id) {
  if (id) {
    if (renderedIds.has(id)) return
    renderedIds.add(id)
  }
  const area = document.getElementById('messagesArea')
  if (!area) return
  const isVisitor = role === 'visitor'
  const isOwner = role === 'owner'

  const div = document.createElement('div')
  div.className = 'flex items-start gap-3 mb-4 fade-in ' + (isVisitor ? 'flex-row-reverse' : '')
  if (id) div.dataset.msgId = id

  const avatar = isVisitor ? '' : (isOwner ? '👤' : '🤖')
  const bubbleClass = isVisitor
    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
    : isOwner
      ? 'bg-emerald-800/60 text-gray-100 rounded-2xl rounded-tl-sm border border-emerald-700/40'
      : 'bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm'

  const AI_NAME = window.AI_NAME || 'AI'
  const label = isVisitor
    ? ''
    : (isOwner
        ? '<div class="text-xs text-gray-500 mt-1 pl-1">本人</div>'
        : '<div class="text-xs text-gray-600 mt-1 pl-1">' + AI_NAME + '</div>')

  const bodyHtml = isVisitor ? escapeHtml(content) : renderMd(content)
  const avatarBgClass = isOwner ? 'bg-emerald-700' : 'bg-gradient-to-br from-blue-500 to-purple-600'

  if (isVisitor) {
    div.innerHTML = '<div><div class="msg-bubble ' + bubbleClass + ' px-4 py-3 text-sm leading-relaxed">' + bodyHtml + '</div></div>'
  } else {
    div.innerHTML =
      '<div class="w-8 h-8 rounded-full ' + avatarBgClass + ' flex items-center justify-center text-sm flex-shrink-0">' + avatar + '</div>' +
      '<div><div class="msg-bubble md-content ' + bubbleClass + ' px-4 py-3 text-sm leading-relaxed">' + bodyHtml + '</div>' + label + '</div>'
  }

  area.appendChild(div)
  area.scrollTop = area.scrollHeight
}

function startPolling() {
  if (pollTimer) return
  pollTimer = setInterval(async function() {
    if (!sessionId) return
    try {
      const resp = await fetch('/api/sessions/' + sessionId + '/messages?since=' + lastTs)
      const data = await resp.json()
      if (data.session) {
        const badge = document.getElementById('ownerOnlineBadge')
        if (badge) {
          data.session.is_owner_online
            ? badge.classList.remove('hidden')
            : badge.classList.add('hidden')
        }
      }
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(function(msg) {
          appendMessage(msg.role, msg.content, msg.id)
          lastTs = msg.created_at
        })
      }
    } catch(e) {}
  }, 2000)
}

async function initSession() {
  const nameInput = document.getElementById('visitorNameInput')
  const visitorName = nameInput ? nameInput.value.trim() : ''
  
  // 尝试从 localStorage 恢复之前的 session
  const storageKey = 'session_' + window.OWNER_ID
  const savedSessionId = localStorage.getItem(storageKey)
  
  if (savedSessionId) {
    // 验证 session 是否仍然有效
    try {
      const checkResp = await fetch('/api/sessions/' + savedSessionId + '/check')
      const checkData = await checkResp.json()
      if (checkData.valid && checkData.session.status !== 'closed') {
        sessionId = savedSessionId
        console.log('✅ 恢复之前的会话:', sessionId)
        // 加载历史消息
        await loadHistoryMessages(sessionId)
        const sec = document.getElementById('visitorNameSection')
        if (sec) sec.style.display = 'none'
        startPolling()
        return sessionId
      }
    } catch(e) {}
    // session 无效，清除存储
    localStorage.removeItem(storageKey)
  }
  
  // 创建新 session，如果有 visitorToken 也一并传递
  const body = { 
    ownerId: window.OWNER_ID, 
    visitorName: visitorName || null 
  }
  if (visitorToken) {
    body.visitorToken = visitorToken
  }
  
  const resp = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await resp.json()
  sessionId = data.sessionId
  
  // 保存到 localStorage
  localStorage.setItem(storageKey, sessionId)
  console.log('✅ 创建新会话:', sessionId)
  
  const sec = document.getElementById('visitorNameSection')
  if (sec) sec.style.display = 'none'
  startPolling()
  return sessionId
}

async function loadHistoryMessages(sessionId) {
  try {
    const resp = await fetch('/api/sessions/' + sessionId + '/messages?since=0')
    const data = await resp.json()
    if (data.messages && data.messages.length > 0) {
      // 在历史消息前添加分隔线
      const area = document.getElementById('messagesArea')
      if (area) {
        // 添加"历史消息"分隔提示
        const divider = document.createElement('div')
        divider.className = 'text-center text-xs text-gray-600 my-3 fade-in'
        divider.innerHTML = '<span class="px-3 py-1 bg-gray-800 rounded-full">— 历史消息 —</span>'
        area.appendChild(divider)
        
        // 加载历史消息
        data.messages.forEach(function(msg) {
          appendMessage(msg.role, msg.content, msg.id)
          lastTs = msg.created_at
        })
      }
    }
    // 更新在线状态显示
    if (data.session) {
      const badge = document.getElementById('ownerOnlineBadge')
      if (badge) {
        data.session.is_owner_online
          ? badge.classList.remove('hidden')
          : badge.classList.add('hidden')
      }
    }
  } catch(e) {
    console.log('加载历史消息失败:', e)
  }
}

function cancelWaiting() {
  currentAbortId = null
  hideTyping()
  isWaiting = false
  const sendBtn = document.getElementById('sendBtn')
  const cancelBtn = document.getElementById('cancelBtn')
  const input = document.getElementById('messageInput')
  if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('hidden') }
  if (cancelBtn) cancelBtn.classList.add('hidden')
  if (input) { input.disabled = false; input.focus() }
  appendSystemMsg('已打断，可重新提问 ↑')
}

async function sendMessage() {
  if (isWaiting) return
  const input = document.getElementById('messageInput')
  if (!input) return
  const content = input.value.trim()
  if (!content) return

  if (!sessionId) {
    await initSession()
  }

  input.value = ''
  input.style.height = 'auto'
  input.disabled = true

  const sendBtn = document.getElementById('sendBtn')
  const cancelBtn = document.getElementById('cancelBtn')
  if (sendBtn) { sendBtn.disabled = true; sendBtn.classList.add('hidden') }
  if (cancelBtn) cancelBtn.classList.remove('hidden')
  isWaiting = true

  const myAbortId = Date.now() + Math.random()
  currentAbortId = myAbortId

  showTyping()

  try {
    const resp = await fetch('/api/sessions/' + sessionId + '/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content })
    })
    const data = await resp.json()

    if (currentAbortId !== myAbortId) return
    hideTyping()
    appendMessage('visitor', content, data.visitorMessageId)

    if (data.ownerOnline) {
      appendSystemMsg('本人正在查看，稍等回复...')
    } else if (data.aiReply) {
      appendMessage('ai', data.aiReply.content, data.aiReply.id)
    }
  } catch(e) {
    if (currentAbortId !== myAbortId) return
    hideTyping()
    appendSystemMsg('发送失败，请重试')
  }

  if (currentAbortId === myAbortId) {
    isWaiting = false
    currentAbortId = null
    if (input) input.disabled = false
    if (sendBtn) { sendBtn.disabled = false; sendBtn.classList.remove('hidden') }
    if (cancelBtn) cancelBtn.classList.add('hidden')
    if (input) input.focus()
  }
}

// ── DOM 就绪后绑定事件 ────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // 加载访客信息
  loadVisitorInfo()
  
  const textarea = document.getElementById('messageInput')
  if (textarea) {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto'
      this.style.height = Math.min(this.scrollHeight, 120) + 'px'
    })
    textarea.addEventListener('keydown', function(e) {
      // 如果正在输入法组合中（如中文输入法选词），不触发发送
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    })
  }
})

window.addEventListener('beforeunload', function() {
  if (pollTimer) clearInterval(pollTimer)
})

// 挂到 window，供 HTML 的 onclick 调用
window.sendMessage = sendMessage
window.cancelWaiting = cancelWaiting
window.showAuthModal = showAuthModal
window.hideAuthModal = hideAuthModal
window.switchAuthTab = switchAuthTab
window.visitorLogin = visitorLogin
window.visitorRegister = visitorRegister
window.visitorLogout = visitorLogout
window.showSessionsModal = showSessionsModal
window.hideSessionsModal = hideSessionsModal
window.switchSession = switchSession
window.deleteSession = deleteSession
