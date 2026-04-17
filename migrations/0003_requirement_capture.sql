-- 需求收集配置表
CREATE TABLE IF NOT EXISTS requirement_configs (
    owner_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    strategy_prompt TEXT DEFAULT '',
    fields_schema TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
);

-- 需求记录表
CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    feature_desc TEXT NOT NULL,
    use_case TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'pending',
    mention_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_requirements_owner ON requirements(owner_id);
CREATE INDEX IF NOT EXISTS idx_requirements_session ON requirements(session_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);

-- 为现有主人插入默认配置
INSERT OR IGNORE INTO requirement_configs (owner_id, enabled, strategy_prompt, fields_schema)
SELECT 
    id as owner_id,
    0 as enabled,
    '当访客提到想要某个功能或提出改进建议时，请主动询问以下信息：

1. **功能描述**：请访客具体描述想要的功能是什么
2. **使用场景**：请访客说明这个功能会在什么情况下使用，解决什么问题
3. **优先级**：询问访客认为这个功能的重要程度（高/中/低）

收集到完整信息后，使用 save_requirement 工具保存需求。' as strategy_prompt,
    '{"fields": ["feature_desc", "use_case", "priority"]}' as fields_schema
FROM owners;
