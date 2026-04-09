"""
辅助函数
"""
import uuid
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash


def generate_id():
    """生成唯一 ID"""
    return str(uuid.uuid4())


def generate_token():
    """生成登录令牌"""
    return secrets.token_urlsafe(32)


def hash_password(password):
    """密码哈希"""
    return generate_password_hash(password)


def verify_password(password_hash, password):
    """验证密码"""
    return check_password_hash(password_hash, password)


def get_token_expiry():
    """获取令牌过期时间（24小时后）"""
    return datetime.utcnow() + timedelta(days=1)
