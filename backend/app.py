"""
Flask 主应用入口
"""
from flask import Flask, jsonify, send_from_directory, render_template_string
from flask_cors import CORS
from config import Config
from models import db, Owner, OnlineStatus
from routes import session_bp, message_bp, owner_bp
from utils.helpers import hash_password
import os

# 创建 Flask 应用 - 设置前端目录
app = Flask(
    __name__,
    static_folder='../frontend/static',
    static_url_path='/static'
)
app.config.from_object(Config)

# 启用 CORS
CORS(app, origins=Config.CORS_ORIGINS.split(',') if Config.CORS_ORIGINS != '*' else '*')

# 初始化数据库
db.init_app(app)


# ============ 前端路由 ============

@app.route('/')
def index():
    """首页"""
    frontend_path = os.path.join(os.path.dirname(__file__), '../frontend/index.html')
    with open(frontend_path, 'r', encoding='utf-8') as f:
        return f.read()


@app.route('/u/<owner_id>')
def visitor_chat(owner_id):
    """访客对话页面"""
    owner = Owner.query.get(owner_id)
    if not owner:
        return f"<h1>主人不存在</h1><p>ID: {owner_id}</p>", 404
    
    # 检查在线状态
    online_status = OnlineStatus.query.get(owner_id)
    is_online = online_status.is_online if online_status else False
    
    # 构建 HTML
    html = visitor_chat_page(owner, is_online)
    return html


def visitor_chat_page(owner, is_online=False):
    """生成访客对话页面 HTML"""
    safe_id = owner.id.replace("'", "")
    safe_name = owner.name.replace("'", "")
    safe_ai_name = owner.ai_name.replace("'", "")
    safe_avatar = owner.avatar or owner.name[0] if owner.name else "A"
    safe_bio = owner.bio or ""
    
    ai_greeting = (
        f"你好！我是 {safe_ai_name}，{safe_name} 的 AI 分身。<br>"
        f'<span class="text-gray-400 text-xs">{safe_bio}</span>'
    ) if safe_bio else (
        f"你好！我是 {safe_ai_name}，{safe_name} 的 AI 分身。有什么我可以帮你的吗？"
    )
    
    return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>和 {safe_ai_name} 聊天 · {safe_name}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js"></script>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ background: #0f0f0f; }}
    .chat-container {{ height: calc(100vh - 0px); max-width: 780px; margin: 0 auto; }}
    .messages-area {{ height: calc(100% - 140px); overflow-y: auto; scroll-behavior: smooth; }}
    .messages-area::-webkit-scrollbar {{ width: 4px; }}
    .messages-area::-webkit-scrollbar-track {{ background: transparent; }}
    .messages-area::-webkit-scrollbar-thumb {{ background: #333; border-radius: 2px; }}
    .msg-bubble {{ max-width: 72%; word-break: break-word; }}
    .md-content p {{ margin-bottom: 0.5em; }}
    .md-content p:last-child {{ margin-bottom: 0; }}
    .md-content ul, .md-content ol {{ padding-left: 1.4em; margin-bottom: 0.5em; }}
    .md-content li {{ margin-bottom: 0.25em; }}
    .md-content strong {{ font-weight: 600; color: #e2e8f0; }}
    .md-content em {{ font-style: italic; color: #a0aec0; }}
    .md-content code {{ background: #1a1a2e; color: #90cdf4; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; font-family: monospace; }}
    .md-content pre {{ background: #1a1a2e; border-radius: 8px; padding: 10px 14px; margin: 6px 0; overflow-x: auto; }}
    .md-content pre code {{ background: none; padding: 0; color: #90cdf4; }}
    .md-content h1,.md-content h2,.md-content h3 {{ font-weight: 700; margin: 0.5em 0 0.3em; color: #e2e8f0; }}
    .md-content blockquote {{ border-left: 3px solid #4a5568; padding-left: 10px; margin: 6px 0; color: #a0aec0; }}
    .md-content a {{ color: #63b3ed; text-decoration: underline; }}
    .typing-dot {{ animation: bounce 1.2s infinite; }}
    .typing-dot:nth-child(2) {{ animation-delay: 0.2s; }}
    .typing-dot:nth-child(3) {{ animation-delay: 0.4s; }}
    @keyframes bounce {{ 0%,60%,100%{{transform:translateY(0)}} 30%{{transform:translateY(-6px)}} }}
    .fade-in {{ animation: fadeIn 0.3s ease-in; }}
    @keyframes fadeIn {{ from{{opacity:0;transform:translateY(8px)}} to{{opacity:1;transform:translateY(0)}} }}
  </style>
</head>
<body class="text-white">

<div class="chat-container w-full flex flex-col" id="app">

  <!-- 顶部信息栏 -->
  <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-bold shadow-lg">
      {safe_avatar}
    </div>
    <div class="flex-1">
      <div class="font-semibold text-white flex items-center gap-2">
        <span id="chatTitle">和 {safe_ai_name} 聊天</span>
        <span id="ownerOnlineBadge" class="{''}hidden text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">
          <i class="fas fa-circle text-xs mr-1"></i>本人在线
        </span>
      </div>
      <div class="text-xs text-gray-400">{safe_name} 可查看该对话，也可能用 {safe_ai_name} 回复你</div>
    </div>
  </div>

  <!-- 消息区域 -->
  <div class="messages-area px-4 py-4 flex-1" id="messagesArea">
    <div class="flex items-start gap-3 mb-4 fade-in">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm flex-shrink-0">🤖</div>
      <div>
        <div class="msg-bubble bg-gray-800 text-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
          {ai_greeting}
        </div>
        <div class="text-xs text-gray-600 mt-1 pl-1">{safe_ai_name}</div>
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
        placeholder="发消息给 {safe_ai_name}..."
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
window.OWNER_ID = '{safe_id}'
window.AI_NAME = '{safe_ai_name}'
</script>
<script src="/static/visitor-chat.js"></script>
</body>
</html>'''


@app.route('/owner/login')
def owner_login_page():
    """主人登录页面（简化版）"""
    return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>主人登录 - my-agent</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold mb-2">主人登录</h1>
      <p class="text-gray-400">登录后查看会话和管理 AI 助手</p>
    </div>
    
    <div class="bg-gray-800 rounded-xl p-6 shadow-xl">
      <div class="mb-6">
        <p class="text-sm text-gray-400 mb-4">
          此页面为简化版，完整主人后台功能请参考文档或使用 API。
        </p>
        
        <div class="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h3 class="font-semibold mb-2 text-blue-400">默认测试账号</h3>
          <p class="text-sm text-gray-300 mb-1">邮箱: <code class="bg-gray-700 px-2 py-1 rounded">jennia@example.com</code></p>
          <p class="text-sm text-gray-300">密码: <code class="bg-gray-700 px-2 py-1 rounded">password123</code></p>
        </div>
      </div>
      
      <a href="/" class="block bg-blue-600 hover:bg-blue-700 text-center text-white rounded-xl px-6 py-3 transition">
        返回首页
      </a>
    </div>
  </div>
</body>
</html>'''


# ============ 健康检查和调试路由 ============

@app.route('/api/ping', methods=['GET'])
def ping():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'message': 'Python backend is running',
        'version': '2.0.0'
    })


@app.route('/api/test-ai', methods=['POST'])
def test_ai():
    """测试 AI 连接"""
    try:
        from flask import request
        from services.ai_service import AIService
        
        data = request.json
        message = data.get('message', '你好')
        
        # 创建一个临时 Owner 对象用于测试
        class TempOwner:
            name = "测试主人"
            ai_persona = "你是一个友好的AI助手"
        
        ai_service = AIService()
        response = ai_service.chat(TempOwner(), [], message)
        
        return jsonify({
            'success': True,
            'response': response
        })
    
    except Exception as e:
        import traceback
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


# ============ 注册蓝图 ============

app.register_blueprint(session_bp)
app.register_blueprint(message_bp)
app.register_blueprint(owner_bp)


# ============ 数据库初始化 ============

def init_db():
    """初始化数据库（创建表 + 插入测试数据）"""
    with app.app_context():
        # 创建所有表
        db.create_all()
        print("✅ 数据库表创建成功")
        
        # 检查是否有默认主人
        if not Owner.query.get('jennia'):
            owner = Owner(
                id='jennia',
                name='Jennia',
                bio='专注 AI 应用开发，擅长 Workflow 搭建、RAG 系统、AI 原生应用',
                avatar='https://api.dicebear.com/7.x/avataaars/svg?seed=Jennia',
                ai_name='Jennia的AI助手',
                ai_persona='''你是 Jennia 的 AI 分身，友好、专业地回答访客的问题。

关于 Jennia：
- 职业：AI 应用开发工程师
- 专长：Workflow 搭建、RAG 系统、AI 原生应用
- 项目经验：客服知识库系统、审批自动化流程、AI Agent 开发框架等
- 技术栈：Python、TypeScript、Hono、Flask、Dify、n8n、OpenAI

回答风格：
- 友好、专业、有条理
- 适当使用 emoji 增加亲和力
- 当用户询问 Jennia 的技能、项目时，主动使用搜索工具获取详细信息
- 如果用户询问时间相关问题，使用时间查询工具
''',
                email='jennia@example.com',
                password_hash=hash_password('password123')
            )
            db.session.add(owner)
            
            # 创建在线状态记录
            online_status = OnlineStatus(owner_id='jennia')
            db.session.add(online_status)
            
            db.session.commit()
            print("✅ 默认主人创建成功")
            print("   ID: jennia")
            print("   邮箱: jennia@example.com")
            print("   密码: password123")


# ============ 启动服务器 ============

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🚀 my-agent Python 后端")
    print("="*60)
    
    # 初始化数据库
    init_db()
    
    print("\n📡 服务器配置:")
    print(f"   地址: http://{Config.HOST}:{Config.PORT}")
    print(f"   调试模式: {Config.DEBUG}")
    print(f"   数据库: {Config.SQLALCHEMY_DATABASE_URI}")
    
    print("\n📍 API 端点:")
    print(f"   健康检查: http://{Config.HOST}:{Config.PORT}/api/ping")
    print(f"   测试 AI: http://{Config.HOST}:{Config.PORT}/api/test-ai")
    print(f"   主人信息: http://{Config.HOST}:{Config.PORT}/api/profile/jennia")
    
    print("\n🌐 前端访问:")
    print(f"   访客页面: http://{Config.HOST}:{Config.PORT}/")
    print(f"   主人后台: http://{Config.HOST}:{Config.PORT}/owner/login")
    
    print("\n💡 提示:")
    print("   - 修改 .env 文件配置 OpenAI API")
    print("   - 使用 Ctrl+C 停止服务器")
    print("="*60 + "\n")
    
    # 启动服务器
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )
