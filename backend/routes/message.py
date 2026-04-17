"""
消息管理路由
"""
from flask import Blueprint, request, jsonify
from models import db, Session, Message, OnlineStatus
from services.ai_service import AIService
from utils.helpers import generate_id

message_bp = Blueprint('message', __name__)

# 创建 AI 服务实例（全局单例）
ai_service = None


def get_ai_service():
    """获取 AI 服务实例"""
    global ai_service
    if ai_service is None:
        ai_service = AIService()
    return ai_service


@message_bp.route('/api/sessions/<session_id>/chat', methods=['POST'])
def chat(session_id):
    """发送消息并获取 AI 回复"""
    try:
        data = request.json
        content = data.get('content')
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        # 1. 验证会话
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        print(f"\n📨 收到消息: {content[:50]}... (会话: {session_id})")
        
        # 2. 保存访客消息
        visitor_msg = Message(
            id=generate_id(),
            session_id=session_id,
            role='visitor',
            content=content
        )
        db.session.add(visitor_msg)
        db.session.commit()
        
        print(f"✅ 保存访客消息: {visitor_msg.id}")
        
        # 3. 检查主人是否在线（仅用于显示状态，不阻塞 AI 回复）
        online_status = OnlineStatus.query.get(session.owner_id)
        owner_online = online_status.is_online if online_status else False
        if owner_online:
            print(f"👤 主人在线，同时让 AI 参与回复")
        
        # 4. 获取历史消息（最近 40 条）
        history = Message.query.filter_by(session_id=session_id)\
            .order_by(Message.created_at)\
            .all()
        
        print(f"📚 加载历史消息: {len(history)} 条")
        
        # 5. 调用 AI 服务（包含工具调用）
        ai_content = get_ai_service().chat(
            owner=session.owner,
            messages=history,
            new_message=content
        )
        
        # 6. 保存 AI 回复
        ai_msg = Message(
            id=generate_id(),
            session_id=session_id,
            role='ai',
            content=ai_content
        )
        db.session.add(ai_msg)
        
        # 更新会话时间
        from datetime import datetime
        session.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        print(f"✅ 保存 AI 回复: {ai_msg.id}\n")
        
        return jsonify({
            'visitorMessageId': visitor_msg.id,
            'aiReply': {
                'id': ai_msg.id,
                'content': ai_content
            },
            'ownerOnline': owner_online
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ 处理消息失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to process message'}), 500
