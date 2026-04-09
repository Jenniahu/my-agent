"""
数据模型
"""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Owner(db.Model):
    """主人信息表"""
    __tablename__ = 'owners'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.Text)
    avatar = db.Column(db.String(500))
    ai_name = db.Column(db.String(100), nullable=False)
    ai_persona = db.Column(db.Text)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    sessions = db.relationship('Session', back_populates='owner', cascade='all, delete-orphan', lazy='dynamic')
    tokens = db.relationship('Token', back_populates='owner', cascade='all, delete-orphan', lazy='dynamic')
    online_status = db.relationship('OnlineStatus', back_populates='owner', uselist=False, cascade='all, delete-orphan')
    
    def to_dict(self, include_sensitive=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'name': self.name,
            'bio': self.bio,
            'avatar': self.avatar,
            'ai_name': self.ai_name,
            'ai_persona': self.ai_persona,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        if include_sensitive:
            data['email'] = self.email
            data['updated_at'] = self.updated_at.isoformat() if self.updated_at else None
        return data


class Session(db.Model):
    """会话信息表"""
    __tablename__ = 'sessions'
    
    id = db.Column(db.String(50), primary_key=True)
    owner_id = db.Column(db.String(50), db.ForeignKey('owners.id', ondelete='CASCADE'), nullable=False)
    visitor_name = db.Column(db.String(100))
    status = db.Column(db.String(20), default='active')  # active, taken_over, closed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    owner = db.relationship('Owner', back_populates='sessions')
    messages = db.relationship('Message', back_populates='session', cascade='all, delete-orphan', lazy='dynamic')
    
    # 索引
    __table_args__ = (
        db.Index('idx_sessions_owner', 'owner_id'),
        db.Index('idx_sessions_updated', 'updated_at'),
    )
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'owner_id': self.owner_id,
            'visitor_name': self.visitor_name,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Message(db.Model):
    """消息记录表"""
    __tablename__ = 'messages'
    
    id = db.Column(db.String(50), primary_key=True)
    session_id = db.Column(db.String(50), db.ForeignKey('sessions.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # visitor, ai, owner
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    session = db.relationship('Session', back_populates='messages')
    
    # 索引
    __table_args__ = (
        db.Index('idx_messages_session', 'session_id'),
        db.Index('idx_messages_created', 'created_at'),
    )
    
    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'role': self.role,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class Token(db.Model):
    """登录凭证表"""
    __tablename__ = 'tokens'
    
    token = db.Column(db.String(100), primary_key=True)
    owner_id = db.Column(db.String(50), db.ForeignKey('owners.id', ondelete='CASCADE'), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    owner = db.relationship('Owner', back_populates='tokens')
    
    # 索引
    __table_args__ = (
        db.Index('idx_tokens_owner', 'owner_id'),
        db.Index('idx_tokens_expires', 'expires_at'),
    )


class OnlineStatus(db.Model):
    """在线状态表"""
    __tablename__ = 'online_status'
    
    owner_id = db.Column(db.String(50), db.ForeignKey('owners.id', ondelete='CASCADE'), primary_key=True)
    is_online = db.Column(db.Boolean, default=False)
    last_heartbeat = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    owner = db.relationship('Owner', back_populates='online_status')
