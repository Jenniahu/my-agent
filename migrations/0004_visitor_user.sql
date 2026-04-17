-- 访客用户表
CREATE TABLE IF NOT EXISTS visitors (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 为 sessions 表添加 visitor_id 字段
ALTER TABLE sessions ADD COLUMN visitor_id TEXT;

-- 添加外键约束
-- 注意：SQLite 在 ALTER TABLE 中不支持直接添加外键，需要在应用层处理

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sessions_visitor ON sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_email ON visitors(email);
