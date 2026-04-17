"""
会话管理路由
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Session, Owner
from utils.helpers import generate_id

session_bp = Blueprint('session', __name__)


@session_bp.route('/api/sessions', methods=['POST'])
def create_session():
    """创建新会话"""
    try:
        data = request.json
        owner_id = data.get('ownerId')
        visitor_name = data.get('visitorName')
        visitor_token = data.get('visitorToken')  # 可选：已登录访客的 token
        
        # 验证主人是否存在
        owner = Owner.query.get(owner_id)
        if not owner:
            return jsonify({'error': 'Owner not found'}), 404
        
        # 如果提供了访客 token，验证并获取 visitor_id
        visitor_id = None
        if visitor_token:
            from models import Token
            token_record = Token.query.get(visitor_token)
            if token_record and token_record.expires_at > datetime.utcnow():
                # 检查是否是访客 token（通过查找 Visitor 表）
                from models import Visitor
                visitor = Visitor.query.get(token_record.owner_id)
                if visitor:
                    visitor_id = visitor.id
                    if not visitor_name and visitor.name:
                        visitor_name = visitor.name
        
        # 创建会话
        session = Session(
            id=generate_id(),
            owner_id=owner_id,
            visitor_id=visitor_id,
            visitor_name=visitor_name,
            status='active'
        )
        
        db.session.add(session)
        db.session.commit()
        
        print(f"✅ 创建会话: {session.id} (主人: {owner_id}, 访客: {visitor_id or '匿名'})")
        
        return jsonify({'sessionId': session.id}), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 创建会话失败: {str(e)}")
        return jsonify({'error': 'Failed to create session'}), 500


@session_bp.route('/api/sessions/<session_id>/messages', methods=['GET'])
def get_messages(session_id):
    """获取会话消息"""
    try:
        # 验证会话是否存在
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # 获取时间戳参数
        since = request.args.get('since')
        
        # 查询消息
        query = session.messages.order_by('created_at')
        if since and since != '0':
            from datetime import datetime
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                query = query.filter(db.and_(
                    db.func.datetime(db.text('created_at')) > since_dt
                ))
            except ValueError:
                # 如果解析失败，忽略 since 参数
                pass
        
        messages = query.all()
        
        # 检查主人是否在线
        from models import OnlineStatus
        online_status = OnlineStatus.query.get(session.owner_id)
        is_online = online_status.is_online if online_status else False
        
        return jsonify({
            'messages': [msg.to_dict() for msg in messages],
            'session': {
                'id': session.id,
                'status': session.status,
                'is_owner_online': 1 if is_online else 0
            }
        })
    
    except Exception as e:
        print(f"❌ 获取消息失败: {str(e)}")
        return jsonify({'error': 'Failed to get messages'}), 500


@session_bp.route('/api/sessions/<session_id>/check', methods=['GET'])
def check_session(session_id):
    """检查 session 是否有效"""
    try:
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'valid': False, 'error': 'Session not found'}), 404
        
        # 检查主人是否在线
        from models import OnlineStatus
        online_status = OnlineStatus.query.get(session.owner_id)
        is_online = online_status.is_online if online_status else False
        
        return jsonify({
            'valid': True,
            'session': {
                'id': session.id,
                'status': session.status,
                'is_owner_online': is_online
            }
        })
    
    except Exception as e:
        print(f"❌ 检查会话失败: {str(e)}")
        return jsonify({'valid': False, 'error': 'Failed to check session'}), 500


@session_bp.route('/api/profile/<owner_id>', methods=['GET'])
def get_profile(owner_id):
    """获取主人公开信息"""
    try:
        owner = Owner.query.get(owner_id)
        if not owner:
            return jsonify({'error': 'Owner not found'}), 404
        
        # 检查在线状态
        from models import OnlineStatus
        online_status = OnlineStatus.query.get(owner_id)
        is_online = online_status.is_online if online_status else False
        
        profile = owner.to_dict()
        profile['is_online'] = is_online
        
        return jsonify(profile)
    
    except Exception as e:
        print(f"❌ 获取主人信息失败: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500
