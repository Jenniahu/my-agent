// visitor-chat.js - 访客聊天页逻辑
// OWNER_ID 和 AI_NAME 由内联 <script> 注入到 window 上

let sessionId = null
let lastTs = '0'
let pollTimer = null
let isWaiting = false
let currentAbortId = null
const renderedIds = new Set()

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
  const resp = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId: window.OWNER_ID, visitorName: visitorName || null })
  })
  const data = await resp.json()
  sessionId = data.sessionId
  const sec = document.getElementById('visitorNameSection')
  if (sec) sec.style.display = 'none'
  startPolling()
  return sessionId
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
  const textarea = document.getElementById('messageInput')
  if (textarea) {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto'
      this.style.height = Math.min(this.scrollHeight, 120) + 'px'
    })
    textarea.addEventListener('keydown', function(e) {
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
