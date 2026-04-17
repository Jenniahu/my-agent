"""
访客用户路由
"""
from flask import Blueprint, request, jsonify
from models import db, Visitor, Session, Owner
from utils.helpers import generate_id, hash_password, verify_password
from datetime import datetime, timedelta

visitor_bp = Blueprint('visitor', __name__)


@visitor_bp.route('/api/visitor/register', methods=['POST'])
def register():
    """访客注册"""
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()
        
        if not email or not password:
            return jsonify({'error': '邮箱和密码不能为空'}), 400
        
        # 检查邮箱是否已存在
        existing = Visitor.query.filter_by(email=email).first()
        if existing:
            return jsonify({'error': '该邮箱已注册'}), 409
        
        # 创建访客用户
        visitor = Visitor(
            id=generate_id(),
            email=email,
            password_hash=hash_password(password),
            name=name or None
        )
        
        db.session.add(visitor)
        db.session.commit()
        
        print(f"✅ 访客注册成功: {email}")
        
        return jsonify({
            'success': True,
            'visitor': visitor.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 访客注册失败: {str(e)}")
        return jsonify({'error': '注册失败'}), 500


@visitor_bp.route('/api/visitor/login', methods=['POST'])
def login():
    """访客登录"""
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': '邮箱和密码不能为空'}), 400
        
        # 查找用户
        visitor = Visitor.query.filter_by(email=email).first()
        if not visitor or not verify_password(visitor.password_hash, password):
            return jsonify({'error': '邮箱或密码错误'}), 401
        
        # 生成 token
        token = generate_id()
        from models import Token
        expires_at = datetime.utcnow() + timedelta(days=30)
        
        # 注意：这里复用 Token 表，但 owner_id 为 visitor 的 id
        # 为了区分，我们在前端存储时区分类型
        token_record = Token(
            token=token,
            owner_id=visitor.id,  # 这里存 visitor id
            expires_at=expires_at
        )
        db.session.add(token_record)
        db.session.commit()
        
        print(f"✅ 访客登录成功: {email}")
        
        return jsonify({
            'success': True,
            'token': token,
            'visitor': visitor.to_dict()
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 访客登录失败: {str(e)}")
        return jsonify({'error': '登录失败'}), 500


@visitor_bp.route('/api/visitor/sessions', methods=['GET'])
def get_my_sessions():
    """获取当前访客的所有会话"""
    try:
        # 从 header 获取 token
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': '未登录'}), 401
        
        from models import Token
        token_record = Token.query.get(token)
        if not token_record or token_record.expires_at < datetime.utcnow():
            return jsonify({'error': '登录已过期'}), 401
        
        visitor = Visitor.query.get(token_record.owner_id)
        if not visitor:
            return jsonify({'error': '用户不存在'}), 404
        
        # 获取该访客的所有会话，包含主人信息
        sessions = Session.query.filter_by(visitor_id=visitor.id).order_by(Session.updated_at.desc()).all()
        
        result = []
        for session in sessions:
            owner = Owner.query.get(session.owner_id)
            # 获取最后一条消息预览
            last_msg = session.messages.order_by('created_at').first()
            
            result.append({
                'id': session.id,
                'owner': {
                    'id': owner.id if owner else None,
                    'name': owner.name if owner else '未知',
                    'ai_name': owner.ai_name if owner else 'AI助手'
                },
                'status': session.status,
                'created_at': session.created_at.isoformat() if session.created_at else None,
                'updated_at': session.updated_at.isoformat() if session.updated_at else None,
                'preview': last_msg.content[:50] + '...' if last_msg and len(last_msg.content) > 50 else (last_msg.content if last_msg else '')
            })
        
        return jsonify({
            'sessions': result,
            'visitor': visitor.to_dict()
        })
    
    except Exception as e:
        print(f"❌ 获取会话列表失败: {str(e)}")
        return jsonify({'error': '获取失败'}), 500


@visitor_bp.route('/api/visitor/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """删除访客的一个会话（软删除/标记为 closed）"""
    try:
        # 验证登录
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': '未登录'}), 401
        
        from models import Token
        token_record = Token.query.get(token)
        if not token_record or token_record.expires_at < datetime.utcnow():
            return jsonify({'error': '登录已过期'}), 401
        
        visitor = Visitor.query.get(token_record.owner_id)
        if not visitor:
            return jsonify({'error': '用户不存在'}), 404
        
        # 查找会话并验证归属
        session = Session.query.filter_by(id=session_id, visitor_id=visitor.id).first()
        if not session:
            return jsonify({'error': '会话不存在或无权限'}), 404
        
        # 标记为 closed
        session.status = 'closed'
        db.session.commit()
        
        print(f"✅ 访客删除会话: {session_id}")
        
        return jsonify({'success': True, 'message': '会话已删除'})
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 删除会话失败: {str(e)}")
        return jsonify({'error': '删除失败'}), 500


@visitor_bp.route('/api/visitor/profile', methods=['GET'])
def get_profile():
    """获取当前访客信息"""
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': '未登录'}), 401
        
        from models import Token
        token_record = Token.query.get(token)
        if not token_record or token_record.expires_at < datetime.utcnow():
            return jsonify({'error': '登录已过期'}), 401
        
        visitor = Visitor.query.get(token_record.owner_id)
        if not visitor:
            return jsonify({'error': '用户不存在'}), 404
        
        return jsonify({'visitor': visitor.to_dict()})
    
    except Exception as e:
        return jsonify({'error': '获取失败'}), 500
