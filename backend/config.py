"""
配置文件
"""
import os
from dotenv import load_dotenv

load_dotenv()  # 加载 .env 文件


class Config:
    """配置类"""

    # 数据库配置
    # Render 注入的 DATABASE_URL 是 postgres:// 前缀，SQLAlchemy 需要 postgresql://
    _db_url = os.getenv('DATABASE_URL', 'sqlite:///myagent.db')
    if _db_url.startswith('postgres://'):
        _db_url = _db_url.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,       # 自动检测断开的连接
        'pool_recycle': 300,         # 5分钟回收连接，防止 Neon 闲置断开
    }

    # OpenAI 配置
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://llm.mcisaas.com')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'MiniMax-M2.5')

    # Flask 配置
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'False') == 'True'

    # CORS 配置
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')

    # 服务器配置
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', '5000'))
