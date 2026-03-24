// src/lib/utils.ts

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

// ─── KV Key 规范 ─────────────────────────────
// owner:{id}              → Owner 对象
// sessions:{ownerId}      → string[] session IDs（按时间倒序）
// session:{id}            → Session 对象
// msgs:{sessionId}        → Message[] 数组
// token:{token}           → ownerId string
// online:{ownerId}        → 'true' (TTL 30s)

export const kv = {
  ownerKey: (id: string) => `owner:${id}`,
  sessionsKey: (ownerId: string) => `sessions:${ownerId}`,
  sessionKey: (id: string) => `session:${id}`,
  msgsKey: (sessionId: string) => `msgs:${sessionId}`,
  tokenKey: (token: string) => `token:${token}`,
  onlineKey: (ownerId: string) => `online:${ownerId}`,
}
