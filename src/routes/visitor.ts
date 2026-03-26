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
  const safeId = owner.id.replace(/'/g, '')
  const safeName = owner.name.replace(/'/g, '')
  const safeAiName = owner.ai_name.replace(/'/g, '')
  const safeAvatar = owner.avatar || owner.name.charAt(0)
  const safeBio = owner.bio || ''
  const aiGreeting = safeBio
    ? `你好！我是 ${safeAiName}，${safeName} 的 AI 分身。<br><span class="text-gray-400 text-xs">${safeBio}</span>`
    : `你好！我是 ${safeAiName}，${safeName} 的 AI 分身。有什么我可以帮你的吗？`

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>和 ${safeAiName} 聊天 · ${safeName}</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body { background: #0f0f0f; }
    .chat-container { height: calc(100vh - 0px); max-width: 780px; margin: 0 auto; }
    .messages-area { height: calc(100% - 140px); overflow-y: auto; scroll-behavior: smooth; }
    .messages-area::-webkit-scrollbar { width: 4px; }
    .messages-area::-webkit-scrollbar-track { background: transparent; }
    .messages-area::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
    .msg-bubble { max-width: 72%; word-break: break-word; }
    .md-content p { margin-bottom: 0.5em; }
    .md-content p:last-child { margin-bottom: 0; }
    .md-content ul, .md-content ol { padding-left: 1.4em; margin-bottom: 0.5em; }
    .md-content li { margin-bottom: 0.25em; }
    .md-content strong { font-weight: 600; color: #e2e8f0; }
    .md-content em { font-style: italic; color: #a0aec0; }
    .md-content code { background: #1a1a2e; color: #90cdf4; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; font-family: monospace; }
    .md-content pre { background: #1a1a2e; border-radius: 8px; padding: 10px 14px; margin: 6px 0; overflow-x: auto; }
    .md-content pre code { background: none; padding: 0; color: #90cdf4; }
    .md-content h1,.md-content h2,.md-content h3 { font-weight: 700; margin: 0.5em 0 0.3em; color: #e2e8f0; }
    .md-content blockquote { border-left: 3px solid #4a5568; padding-left: 10px; margin: 6px 0; color: #a0aec0; }
    .md-content a { color: #63b3ed; text-decoration: underline; }
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
      ${safeAvatar}
    </div>
    <div class="flex-1">
      <div class="font-semibold text-white flex items-center gap-2">
        <span id="chatTitle">和 ${safeAiName} 聊天</span>
        <span id="ownerOnlineBadge" class="hidden text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
          <i class="fas fa-circle text-xs mr-1"></i>本人在线
        </span>
      </div>
      <div class="text-xs text-gray-400">${safeName} 可查看该对话，也可能用 ${safeAiName} 回复你</div>
    </div>
  </div>

  <!-- 消息区域 -->
  <div class="messages-area px-4 py-4 flex-1" id="messagesArea">
    <div class="flex items-start gap-3 mb-4 fade-in">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
      <div>
        <div class="msg-bubble bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
          ${aiGreeting}
        </div>
        <div class="text-xs text-gray-600 mt-1 pl-1">${safeAiName}</div>
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
        placeholder="发消息给 ${safeAiName}..."
        rows="1"
        class="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 outline-none border border-gray-700 focus:border-blue-500 transition resize-none placeholder-gray-500 leading-relaxed"
        style="min-height:44px;max-height:120px;overflow-y:auto"
      ></textarea>
      <div class="flex flex-col gap-1">
        <button id="sendBtn"
          class="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white w-11 h-11 rounded-xl flex items-center justify-center transition flex-shrink-0"
          onclick="sendMessage()">
          <i class="fas fa-paper-plane text-sm"></i>
        </button>
        <button id="cancelBtn"
          class="hidden bg-red-600/80 hover:bg-red-700 text-white w-11 h-11 rounded-xl flex items-center justify-center transition flex-shrink-0"
          onclick="cancelWaiting()" title="取消，重新提问">
          <i class="fas fa-stop text-sm"></i>
        </button>
      </div>
    </div>
    <div class="text-xs text-gray-600 mt-2 text-center">
      等待回复时可点 <i class="fas fa-stop text-xs"></i> 打断并重新提问
    </div>
  </div>

</div>

<script>
window.OWNER_ID = '${safeId}'
window.AI_NAME = '${safeAiName}'
<\/script>
<script src="/static/visitor-chat.js"><\/script>
</body>
</html>`
}
