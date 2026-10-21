// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  readUsageCookie,
  resolveUsage,
  serializeUsageCookie,
  USAGE_COOKIE_NAME,
  type AnonymousUsage,
} from './usageCookie.js'

const SECRET = 'a'.repeat(40)
const usage: AnonymousUsage = { id: 'abc', dayKey: '2026-01-15', successCount: 3, issuedAt: 1 }

const withCookie = (cookie: string) => new Request('http://x', { headers: { Cookie: cookie } })
const pair = (serialized: string) => serialized.split(';')[0]

describe('usage cookie', () => {
  it('round-trips through signing and verification, next to other cookies', () => {
    const cookie = pair(serializeUsageCookie(usage, SECRET))
    expect(readUsageCookie(withCookie(`other=1; ${cookie}; more=2`), SECRET)).toEqual(usage)
  })

  it('sets HttpOnly, Secure, SameSite=Lax and Path=/', () => {
    const header = serializeUsageCookie(usage, SECRET)
    expect(header).toMatch(new RegExp(`^${USAGE_COOKIE_NAME}=`))
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=']) {
      expect(header).toContain(attribute)
    }
  })

  it('rejects a changed payload, a wrong signature or another secret', () => {
    const [name, value] = pair(serializeUsageCookie(usage, SECRET)).split('=')
    const [, signature] = value.split('.')
    const changed = Buffer.from(JSON.stringify({ ...usage, successCount: 0 })).toString('base64url')
    expect(readUsageCookie(withCookie(`${name}=${changed}.${signature}`), SECRET)).toBeNull()
    expect(readUsageCookie(withCookie(`${name}=${value.slice(0, -2)}xx`), SECRET)).toBeNull()
    expect(readUsageCookie(withCookie(`${name}=${value}`), 'b'.repeat(40))).toBeNull()
  })

  it.each([
    ['no cookie', ''],
    ['garbage', `${USAGE_COOKIE_NAME}=not-a-cookie`],
    ['too long', `${USAGE_COOKIE_NAME}=${'a'.repeat(1100)}.sig`],
  ])('returns null for %s', (_label, cookie) => {
    expect(readUsageCookie(withCookie(cookie), SECRET)).toBeNull()
  })

  it('rejects a correctly signed payload with invalid fields', () => {
    const bad = { ...usage, successCount: -1 }
    const cookie = pair(serializeUsageCookie(bad as AnonymousUsage, SECRET))
    expect(readUsageCookie(withCookie(cookie), SECRET)).toBeNull()
  })
})

describe('resolveUsage', () => {
  it('issues a new id at zero without a cookie', () => {
    const { usage: fresh, changed } = resolveUsage(null, '2026-01-15', 5)
    expect(changed).toBe(true)
    expect(fresh).toMatchObject({ dayKey: '2026-01-15', successCount: 0, issuedAt: 5 })
    expect(fresh.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps the id and resets the count on a new day', () => {
    expect(resolveUsage(usage, '2026-01-16', 5)).toEqual({
      usage: { ...usage, dayKey: '2026-01-16', successCount: 0 },
      changed: true,
    })
  })

  it('keeps the same day unchanged', () => {
    expect(resolveUsage(usage, '2026-01-15', 5)).toEqual({ usage, changed: false })
  })
})
