"""
路由包初始化文件
"""
from routes.session import session_bp
from routes.message import message_bp
from routes.owner import owner_bp
from routes.visitor import visitor_bp

__all__ = ['session_bp', 'message_bp', 'owner_bp', 'visitor_bp']
