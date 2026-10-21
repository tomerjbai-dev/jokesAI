// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleJokeRequest } from './jokeHandler.js'
import { handleStatusRequest } from './statusHandler.js'
import { serializeUsageCookie } from './usageCookie.js'
import { createUsageState, type UsageState } from './usageState.js'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const NOON = Date.parse('2026-01-15T10:00:00Z')

const get = (cookie?: string, ip = '203.0.113.7') =>
  new Request('http://localhost/api/status', {
    headers: { 'x-forwarded-for': ip, ...(cookie ? { Cookie: cookie } : {}) },
  })

const usageCookie = (successCount: number, dayKey = '2026-01-15') =>
  serializeUsageCookie({ id: 'user-1', dayKey, successCount, issuedAt: NOON }, SECRET).split(';')[0]

let clock: number
let state: UsageState

beforeEach(() => {
  vi.stubEnv('COOKIE_SIGNING_SECRET', SECRET)
  clock = NOON
  state = createUsageState(() => clock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/status', () => {
  it('gives a first visit the full balance and a new signed cookie', async () => {
    const response = handleStatusRequest(get(), { state })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly')
    expect(await response.json()).toEqual({ remainingToday: 20, dailyLimit: 20, globalAvailableEstimate: true })
  })

  it('reads the balance from the cookie, without resending an unchanged cookie', async () => {
    const response = handleStatusRequest(get(usageCookie(7)), { state })
    expect((await response.json()).remainingToday).toBe(13)
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  it('shows a full balance again on a new day in Israel', async () => {
    clock = Date.parse('2026-01-15T22:00:00Z')
    const response = handleStatusRequest(get(usageCookie(20)), { state })
    expect((await response.json()).remainingToday).toBe(20)
    expect(response.headers.get('Set-Cookie')).not.toBeNull()
  })

  it('reports an active rate limit and a full global counter, without counting itself', async () => {
    vi.stubEnv('GLOBAL_DAILY_LIMIT', '5')
    const generateJoke = vi.fn(async () => ({ kind: 'joke' as const, joke: 'x' }))
    const post = () =>
      new Request('http://localhost/api/jokes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: '{}',
      })
    for (let i = 0; i < 5; i++) await handleJokeRequest(post(), { generateJoke, state })
    for (let i = 0; i < 10; i++) handleStatusRequest(get(), { state })

    clock += 15_000
    const body = await handleStatusRequest(get(), { state }).json()
    expect(body.retryAfterSeconds).toBe(45)
    expect(body.globalAvailableEstimate).toBe(false)

    clock += 45_000
    expect(await handleStatusRequest(get(), { state }).json()).not.toHaveProperty('retryAfterSeconds')
  })

  it('fails without a signing secret', () => {
    vi.stubEnv('COOKIE_SIGNING_SECRET', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(handleStatusRequest(get(), { state }).status).toBe(500)
  })
})
