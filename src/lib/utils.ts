// src/lib/utils.ts - 工具函数

export function generateId(): string {
  return crypto.randomUUID()
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return computed === hash
}

// 从 KV 获取 owner 的在线状态（用于轮询）
export function getOwnerOnlineKey(ownerId: string): string {
  return `owner_online:${ownerId}`
}

// 会话最新消息的 KV key（用于实时轮询）
export function getSessionKey(sessionId: string): string {
  return `session_ts:${sessionId}`
}
