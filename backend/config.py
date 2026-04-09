"""
配置文件
"""
import os
from dotenv import load_dotenv

load_dotenv()  # 加载 .env 文件


class Config:
    """配置类"""
    
    # 数据库配置
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'sqlite:///myagent.db'  # 默认 SQLite
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # OpenAI 配置
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
    OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://llm.mcisaas.com')
    OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'MiniMax-M2.5')
    
    # Flask 配置
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'True') == 'True'
    
    # CORS 配置
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    
    # 服务器配置
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', '5000'))
