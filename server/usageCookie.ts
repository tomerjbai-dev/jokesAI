import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

// The anonymous id and personal success counter, kept in a signed HttpOnly cookie (ARCHITECTURE §2.3).
// Signing stops forgery, but not replay of an older cookie or races between parallel responses.

export const USAGE_COOKIE_NAME = 'bdichomat_usage'
const MAX_COOKIE_LENGTH = 1024
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60

export type AnonymousUsage = { id: string; dayKey: string; successCount: number; issuedAt: number }

// `changed` means the cookie must be (re)sent even without a success: a new id or a new day.
export type ResolvedUsage = { usage: AnonymousUsage; changed: boolean }

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function cookieValue(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index !== -1 && part.slice(0, index).trim() === USAGE_COOKIE_NAME) return part.slice(index + 1).trim()
  }
  return null
}

function isUsage(value: unknown): value is AnonymousUsage {
  if (typeof value !== 'object' || value === null) return false
  const { id, dayKey, successCount, issuedAt } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    id !== '' &&
    typeof dayKey === 'string' &&
    Number.isInteger(successCount) &&
    (successCount as number) >= 0 &&
    typeof issuedAt === 'number'
  )
}

// Returns null for a missing, oversized, tampered or malformed cookie.
export function readUsageCookie(request: Request, secret: string): AnonymousUsage | null {
  const value = cookieValue(request)
  if (!value || value.length > MAX_COOKIE_LENGTH) return null
  const [payload, signature, extra] = value.split('.')
  if (!payload || !signature || extra !== undefined) return null

  const expected = Buffer.from(sign(payload, secret))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return isUsage(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function resolveUsage(cookie: AnonymousUsage | null, today: string, now: number): ResolvedUsage {
  if (!cookie) return { usage: { id: randomUUID(), dayKey: today, successCount: 0, issuedAt: now }, changed: true }
  // Same id on a new day, with the counter reset.
  if (cookie.dayKey !== today) return { usage: { ...cookie, dayKey: today, successCount: 0 }, changed: true }
  return { usage: cookie, changed: false }
}

export function serializeUsageCookie(usage: AnonymousUsage, secret: string): string {
  const payload = Buffer.from(JSON.stringify(usage)).toString('base64url')
  const value = `${payload}.${sign(payload, secret)}`
  return `${USAGE_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`
}
