"""
主人管理路由
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db, Owner, Session, Message, Token, OnlineStatus
from utils.helpers import generate_id, generate_token, hash_password, verify_password, get_token_expiry

owner_bp = Blueprint('owner', __name__)


@owner_bp.route('/api/owner/register', methods=['POST'])
def register():
    """注册主人（开发用）"""
    try:
        data = request.json
        
        # 检查邮箱是否已存在
        existing = Owner.query.filter_by(email=data['email']).first()
        if existing:
            return jsonify({'error': 'Email already exists'}), 400
        
        # 创建主人
        owner = Owner(
            id=data['id'],
            name=data['name'],
            bio=data.get('bio', ''),
            avatar=data.get('avatar', ''),
            ai_name=data['ai_name'],
            ai_persona=data.get('ai_persona', f"你是 {data['name']} 的 AI 分身，友好、专业地回答问题。"),
            email=data['email'],
            password_hash=hash_password(data['password'])
        )
        
        db.session.add(owner)
        
        # 创建在线状态记录
        online_status = OnlineStatus(owner_id=owner.id)
        db.session.add(online_status)
        
        db.session.commit()
        
        print(f"✅ 注册主人: {owner.id} ({owner.email})")
        
        return jsonify({'message': 'Owner registered successfully', 'ownerId': owner.id}), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 注册失败: {str(e)}")
        return jsonify({'error': 'Registration failed'}), 500


@owner_bp.route('/api/owner/login', methods=['POST'])
def login():
    """主人登录"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        # 查找主人
        owner = Owner.query.filter_by(email=email).first()
        if not owner or not verify_password(owner.password_hash, password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # 生成令牌
        token = generate_token()
        token_obj = Token(
            token=token,
            owner_id=owner.id,
            expires_at=get_token_expiry()
        )
        
        db.session.add(token_obj)
        db.session.commit()
        
        print(f"✅ 主人登录: {owner.id}")
        
        return jsonify({
            'token': token,
            'owner': owner.to_dict(include_sensitive=True)
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 登录失败: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500


@owner_bp.route('/api/owner/logout', methods=['POST'])
def logout():
    """主人登出"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if token:
            token_obj = Token.query.get(token)
            if token_obj:
                db.session.delete(token_obj)
                db.session.commit()
                print(f"✅ 主人登出: {token_obj.owner_id}")
        
        return jsonify({'message': 'Logged out successfully'})
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 登出失败: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500


@owner_bp.route('/api/owner/verify', methods=['GET'])
def verify():
    """验证登录状态"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        
        if not token:
            return jsonify({'error': 'No token provided'}), 401
        
        token_obj = Token.query.get(token)
        if not token_obj or token_obj.expires_at < datetime.utcnow():
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        owner = token_obj.owner
        return jsonify({'owner': owner.to_dict(include_sensitive=True)})
    
    except Exception as e:
        print(f"❌ 验证失败: {str(e)}")
        return jsonify({'error': 'Verification failed'}), 500


@owner_bp.route('/api/owner/profile', methods=['GET', 'PUT'])
def profile():
    """获取/更新主人信息"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        token_obj = Token.query.get(token)
        
        if not token_obj:
            return jsonify({'error': 'Unauthorized'}), 401
        
        owner = token_obj.owner
        
        if request.method == 'GET':
            return jsonify(owner.to_dict(include_sensitive=True))
        
        elif request.method == 'PUT':
            data = request.json
            
            # 更新字段
            if 'name' in data:
                owner.name = data['name']
            if 'bio' in data:
                owner.bio = data['bio']
            if 'avatar' in data:
                owner.avatar = data['avatar']
            if 'ai_name' in data:
                owner.ai_name = data['ai_name']
            if 'ai_persona' in data:
                owner.ai_persona = data['ai_persona']
            
            owner.updated_at = datetime.utcnow()
            db.session.commit()
            
            print(f"✅ 更新主人信息: {owner.id}")
            
            return jsonify(owner.to_dict(include_sensitive=True))
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 操作失败: {str(e)}")
        return jsonify({'error': 'Operation failed'}), 500


@owner_bp.route('/api/owner/sessions', methods=['GET'])
def get_sessions():
    """获取主人的会话列表"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        token_obj = Token.query.get(token)
        
        if not token_obj:
            return jsonify({'error': 'Unauthorized'}), 401
        
        owner = token_obj.owner
        
        # 查询会话
        sessions = Session.query.filter_by(owner_id=owner.id)\
            .order_by(Session.updated_at.desc())\
            .all()
        
        # 为每个会话添加最后一条消息
        result = []
        for session in sessions:
            session_dict = session.to_dict()
            
            # 获取最后一条消息
            last_msg = Message.query.filter_by(session_id=session.id)\
                .order_by(Message.created_at.desc())\
                .first()
            
            session_dict['last_message'] = last_msg.to_dict() if last_msg else None
            result.append(session_dict)
        
        return jsonify({'sessions': result})
    
    except Exception as e:
        print(f"❌ 获取会话列表失败: {str(e)}")
        return jsonify({'error': 'Failed to get sessions'}), 500


@owner_bp.route('/api/owner/sessions/<session_id>/reply', methods=['POST'])
def reply_to_session(session_id):
    """主人回复会话"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        token_obj = Token.query.get(token)
        
        if not token_obj:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.json
        content = data.get('content')
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        # 验证会话
        session = Session.query.get(session_id)
        if not session or session.owner_id != token_obj.owner_id:
            return jsonify({'error': 'Session not found'}), 404
        
        # 保存主人回复
        owner_msg = Message(
            id=generate_id(),
            session_id=session_id,
            role='owner',
            content=content
        )
        
        db.session.add(owner_msg)
        
        # 更新会话状态和时间
        session.status = 'taken_over'
        session.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"✅ 主人回复: {session_id}")
        
        return jsonify(owner_msg.to_dict())
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 主人回复失败: {str(e)}")
        return jsonify({'error': 'Failed to reply'}), 500


@owner_bp.route('/api/owner/heartbeat', methods=['POST'])
def heartbeat():
    """主人心跳（更新在线状态）"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        token_obj = Token.query.get(token)
        
        if not token_obj:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # 更新在线状态
        online_status = OnlineStatus.query.get(token_obj.owner_id)
        if not online_status:
            online_status = OnlineStatus(owner_id=token_obj.owner_id)
            db.session.add(online_status)
        
        online_status.is_online = True
        online_status.last_heartbeat = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Heartbeat received', 'is_online': True})
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 心跳失败: {str(e)}")
        return jsonify({'error': 'Heartbeat failed'}), 500
