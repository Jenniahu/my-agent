-- 插入一个示例主人账号（密码: demo123）
INSERT OR IGNORE INTO owners (id, name, bio, avatar, ai_name, ai_persona, email, password_hash) VALUES (
  'demo',
  'Demo User',
  '独立开发者 / AI 产品探索者，专注于效率工具和创意项目。',
  '🚀',
  'Tara',
  '你是 Demo User 的 AI 分身，名叫 Tara。你代表 Demo User 和来访者对话。你了解他的工作背景：独立开发者，专注 AI 工具和效率产品。请用友好、专业的口吻回答问题。如果访客询问合作或联系方式，告诉他们可以发邮件到 demo@example.com，Demo User 会在看到后亲自回复。对于超出你了解范围的问题，诚实说明并建议直接联系。',
  'demo@example.com',
  'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791'
);
