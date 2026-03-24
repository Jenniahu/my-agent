-- 主人(Owner)配置表：存储 AI 分身的个人信息和设置
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,           -- 例如 'kiya'，即用户名/slug
  name TEXT NOT NULL,            -- 显示名称
  bio TEXT,                      -- 个人简介
  avatar TEXT,                   -- 头像 emoji 或 URL
  ai_name TEXT NOT NULL DEFAULT 'AI助手', -- AI 分身名称，如 "Tara"
  ai_persona TEXT,               -- AI 人设系统提示词
  email TEXT,                    -- 联系邮箱（可以让 AI 提供给访客）
  password_hash TEXT NOT NULL,   -- 主人登录密码（简单 hash）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话表：每个访客开启一个会话
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,           -- 会话 UUID
  owner_id TEXT NOT NULL,        -- 归属哪个主人
  visitor_name TEXT,             -- 访客自报名字（可选）
  visitor_note TEXT,             -- 访客简短备注
  status TEXT DEFAULT 'active',  -- active | closed | taken_over
  is_owner_online INTEGER DEFAULT 0, -- 主人是否在看
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES owners(id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,            -- 'visitor' | 'ai' | 'owner'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);
