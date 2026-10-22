// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleJokeRequest } from './jokeHandler.js'
import type { JokeOutcome, JokeRequest } from './jokeService.js'
import { readUsageCookie, serializeUsageCookie, USAGE_COOKIE_NAME, type AnonymousUsage } from './usageCookie.js'
import { createUsageState, type UsageState } from './usageState.js'

const SECRET = 'test-secret-that-is-at-least-32-characters-long'
// Noon in Israel on 15 January 2026 (UTC+2).
const NOON = Date.parse('2026-01-15T10:00:00Z')

type Options = { cookie?: string | null; ip?: string }

const post = (body: unknown, { cookie, ip = '203.0.113.7' }: Options = {}) =>
  new Request('http://localhost/api/jokes', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost',
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const generator = (outcome: JokeOutcome) => vi.fn(async (_request: JokeRequest, ..._rest: unknown[]) => outcome)

// The cookie pair (name=value) from a response, ready to send back.
const cookieFrom = (response: Response) => response.headers.get('Set-Cookie')?.split(';')[0] ?? null

const usageCookie = (usage: Partial<AnonymousUsage>) =>
  serializeUsageCookie(
    { id: 'user-1', dayKey: '2026-01-15', successCount: 0, issuedAt: NOON, ...usage },
    SECRET,
  ).split(';')[0]

const countIn = (response: Response) =>
  readUsageCookie(new Request('http://x', { headers: { Cookie: cookieFrom(response) ?? '' } }), SECRET)?.successCount

let clock: number
let state: UsageState

beforeEach(() => {
  // Every request writes a structured log line; keep test output quiet.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.stubEnv('COOKIE_SIGNING_SECRET', SECRET)
  clock = NOON
  state = createUsageState(() => clock)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const send = (body: unknown, generate = generator({ kind: 'joke', joke: 'בדיחה' }), options: Options = {}) =>
  handleJokeRequest(post(body, options), { generateJoke: generate, state })

describe('POST /api/jokes', () => {
  it('returns the joke and the remaining balance with no-store caching', async () => {
    const generate = generator({ kind: 'joke', joke: 'בדיחה' })
    const response = await send({ topic: ' חתולים ', previousJoke: 'ישנה' }, generate)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ joke: 'בדיחה', remainingToday: 19 })
    expect(generate.mock.calls[0][0]).toEqual({ topic: 'חתולים', previousJoke: 'ישנה' })
  })

  it('generates a general joke for an empty or missing topic', async () => {
    const generate = generator({ kind: 'joke', joke: 'בדיחה' })
    await send({ topic: '' }, generate)
    await send({}, generate)
    expect(generate.mock.calls[0][0]).toEqual({ topic: '', previousJoke: undefined })
    expect(generate.mock.calls[1][0]).toEqual({ topic: '', previousJoke: undefined })
  })

  it.each([
    ['whitespace only', { topic: '   ' }],
    ['over 100 characters', { topic: 'א'.repeat(101) }],
    ['a non-string topic', { topic: 42 }],
    ['broken JSON', '{oops'],
  ])('rejects %s with 400 and never calls OpenAI', async (_label, body) => {
    const generate = generator({ kind: 'joke', joke: 'x' })
    const response = await send(body, generate)
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('INVALID_TOPIC')
    expect(generate).not.toHaveBeenCalled()
  })

  it('returns the whitespace message for whitespace-only input', async () => {
    const response = await send({ topic: ' ' }, generator({ kind: 'failed' }))
    expect((await response.json()).message).toBe('רווחים זה נחמד, אבל תנו לנו נושא אמיתי 😅')
  })

  it('maps a refusal to 422 UNSUPPORTED_TOPIC', async () => {
    const response = await send({ topic: 'x' }, generator({ kind: 'refused' }))
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      code: 'UNSUPPORTED_TOPIC',
      message: 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!',
    })
  })

  it('maps a timeout to 504 AI_TIMEOUT', async () => {
    const response = await send({ topic: 'x' }, generator({ kind: 'timeout' }))
    expect(response.status).toBe(504)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      code: 'AI_TIMEOUT',
      message: 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.',
    })
  })

  it('passes the request abort signal so a disconnect cancels the OpenAI call', async () => {
    const generate = generator({ kind: 'joke', joke: 'x' })
    const request = post({ topic: 'x' })
    await handleJokeRequest(request, { generateJoke: generate, state })
    expect(generate).toHaveBeenCalledWith(expect.anything(), undefined, { signal: request.signal })
  })

  it('maps a failure to 500 without leaking the API key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-secret-123')
    const response = await send({ topic: 'x' }, generator({ kind: 'failed' }))
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).not.toContain('sk-test-secret-123')
    expect(JSON.parse(text)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.',
    })
  })

  it('works without a cookie signing secret, using the built-in one (ADR-19)', async () => {
    vi.stubEnv('COOKIE_SIGNING_SECRET', '')
    const first = await send({ topic: 'x' })
    expect(first.status).toBe(200)
    const second = await send({ topic: 'x' }, undefined, { cookie: cookieFrom(first), ip: '10.9.0.1' })
    expect((await second.json()).remainingToday).toBe(18)
  })
})

describe('personal counter (signed cookie)', () => {
  it('issues a signed HttpOnly cookie and counts each success', async () => {
    const first = await send({ topic: 'x' })
    const setCookie = first.headers.get('Set-Cookie')!
    expect(setCookie).toContain(`${USAGE_COOKIE_NAME}=`)
    expect(setCookie).toMatch(/HttpOnly; Secure; SameSite=Lax; Path=\//)

    const second = await send({ topic: 'x' }, undefined, { cookie: cookieFrom(first) })
    expect((await second.json()).remainingToday).toBe(18)
    expect(countIn(second)).toBe(2)
  })

  it.each([
    ['a refusal', { kind: 'refused' }, 422],
    ['a timeout', { kind: 'timeout' }, 504],
    ['a failure', { kind: 'failed' }, 500],
    ['a client abort', { kind: 'aborted' }, 500],
  ] as const)('does not count %s', async (_label, outcome, status) => {
    const cookie = usageCookie({ successCount: 5 })
    const response = await send({ topic: 'x' }, generator(outcome), { cookie })
    expect(response.status).toBe(status)
    // No counter update is sent for an unchanged cookie.
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(state.globalUsage.successCount).toBe(0)
  })

  it('stops at the personal daily limit without calling OpenAI', async () => {
    const generate = generator({ kind: 'joke', joke: 'x' })
    const response = await send({ topic: 'x' }, generate, { cookie: usageCookie({ successCount: 20 }) })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      code: 'PERSONAL_QUOTA_EXCEEDED',
      message: 'נגמרו הבדיחות להיום! חזרו מחר לעוד צחוקים 😄',
    })
    expect(generate).not.toHaveBeenCalled()
  })

  it('a tampered cookie is not trusted: it starts a new id at zero', async () => {
    const [name, value] = usageCookie({ successCount: 20 }).split('=')
    const [payload, signature] = value.split('.')
    const forged = Buffer.from(JSON.stringify({ id: 'user-1', dayKey: '2026-01-15', successCount: 0, issuedAt: NOON })).toString('base64url')
    const response = await send({ topic: 'x' }, undefined, { cookie: `${name}=${forged}.${signature}` })
    expect(response.status).toBe(200)
    expect((await response.json()).remainingToday).toBe(19)
    expect(payload).not.toBe(forged)
  })

  it('starts the count over on a new day in Israel, keeping the id', async () => {
    const cookie = usageCookie({ successCount: 20, dayKey: '2026-01-15' })
    // 00:00 Israel time on 16 January = 22:00 UTC on the 15th.
    clock = Date.parse('2026-01-15T22:00:00Z')
    const response = await send({ topic: 'x' }, undefined, { cookie })
    expect(response.status).toBe(200)
    expect((await response.json()).remainingToday).toBe(19)
    const usage = readUsageCookie(new Request('http://x', { headers: { Cookie: cookieFrom(response)! } }), SECRET)
    expect(usage).toMatchObject({ id: 'user-1', dayKey: '2026-01-16', successCount: 1 })
  })
})

describe('global daily limit (this instance)', () => {
  it('stops after the global limit of successes, then resets on a new day', async () => {
    vi.stubEnv('GLOBAL_DAILY_LIMIT', '3')
    for (let i = 0; i < 3; i++) {
      expect((await send({ topic: 'x' }, undefined, { ip: `10.0.0.${i}` })).status).toBe(200)
    }
    const blocked = await send({ topic: 'x' }, undefined, { ip: '10.0.1.1' })
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({
      code: 'GLOBAL_QUOTA_EXCEEDED',
      message: 'הקומיקאי שלנו סיים להיום 🎤😴 נגמרו הבדיחות, נתראה מחר!',
    })

    clock = Date.parse('2026-01-15T22:00:00Z')
    expect((await send({ topic: 'x' }, undefined, { ip: '10.0.1.1' })).status).toBe(200)
  })
})

describe('rate limiting (this instance)', () => {
  it('allows 5 attempts a minute, counting unsuccessful ones, then answers 429 with a wait time', async () => {
    let cookie: string | null = null
    for (let i = 0; i < 5; i++) {
      const response = await send({ topic: 'x' }, generator({ kind: 'refused' }), { cookie })
      cookie ??= cookieFrom(response)
      expect(response.status).toBe(422)
    }
    clock += 10_000
    const blocked = await send({ topic: 'x' }, undefined, { cookie })
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('Retry-After')).toBe('50')
    expect(await blocked.json()).toEqual({
      code: 'RATE_LIMITED',
      message: 'רגע, גם לקומיקאי מגיע לנשום 😅',
      retryAfterSeconds: 50,
    })

    clock += 50_000
    expect((await send({ topic: 'x' }, undefined, { cookie })).status).toBe(200)
  })

  it('stays in force after the cookie is deleted (counted by IP too)', async () => {
    for (let i = 0; i < 5; i++) await send({ topic: 'x' })
    const response = await send({ topic: 'x' }, undefined, { cookie: null })
    expect(response.status).toBe(429)
  })

  it('also limits one cookie across different IP addresses', async () => {
    const cookie = usageCookie({})
    for (let i = 0; i < 5; i++) await send({ topic: 'x' }, undefined, { cookie, ip: `10.0.0.${i}` })
    expect((await send({ topic: 'x' }, undefined, { cookie, ip: '10.9.9.9' })).status).toBe(429)
  })

  it('does not count invalid input', async () => {
    for (let i = 0; i < 6; i++) await send({ topic: '  ' })
    expect((await send({ topic: 'x' })).status).toBe(200)
  })

  it('never writes the IP address to the logs', async () => {
    const logs = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ]
    for (let i = 0; i < 8; i++) await send({ topic: 'x' }, generator({ kind: 'failed' }), { ip: '198.51.100.23' })
    const written = JSON.stringify(logs.flatMap((spy) => spy.mock.calls))
    expect(written).not.toContain('198.51.100.23')
  })
})

describe('circuit breaker (this instance)', () => {
  // Distinct IPs and cookies so the rate limit does not interfere.
  let n = 0
  const attempt = (outcome: JokeOutcome) => send({ topic: 'x' }, generator(outcome), { ip: `10.1.0.${n++}` })

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('pauses AI calls for 2 minutes after 5 consecutive failures, then lets one probe through', async () => {
    for (let i = 0; i < 5; i++) await attempt({ kind: 'failed' })

    const generate = generator({ kind: 'joke', joke: 'x' })
    const paused = await send({ topic: 'x' }, generate, { ip: '10.2.0.1' })
    expect(paused.status).toBe(503)
    expect(await paused.json()).toEqual({
      code: 'AI_UNAVAILABLE',
      message: 'הקומיקאי לוקח הפסקה קצרה ☕ אפשר לנסות שוב בעוד כמה דקות.',
    })
    expect(generate).not.toHaveBeenCalled()

    clock += 120_000
    // The single probe succeeds and closes the breaker.
    expect((await attempt({ kind: 'joke', joke: 'x' })).status).toBe(200)
    expect((await attempt({ kind: 'joke', joke: 'x' })).status).toBe(200)
  })

  it('a refusal is not a failure and breaks the streak', async () => {
    for (let i = 0; i < 4; i++) await attempt({ kind: 'timeout' })
    await attempt({ kind: 'refused' })
    for (let i = 0; i < 4; i++) await attempt({ kind: 'failed' })
    expect((await attempt({ kind: 'joke', joke: 'x' })).status).toBe(200)
  })

  it('a client abort is not counted as a failure', async () => {
    for (let i = 0; i < 4; i++) await attempt({ kind: 'failed' })
    await attempt({ kind: 'aborted' })
    expect((await attempt({ kind: 'joke', joke: 'x' })).status).toBe(200)
  })
})

describe('configuration from the environment, without code changes', () => {
  it('reads the limits on every request', async () => {
    vi.stubEnv('PERSONAL_DAILY_LIMIT', '2')
    const first = await send({ topic: 'x' })
    expect((await first.json()).remainingToday).toBe(1)
    const second = await send({ topic: 'x' }, undefined, { cookie: cookieFrom(first) })
    expect((await second.json()).remainingToday).toBe(0)
    expect((await send({ topic: 'x' }, undefined, { cookie: cookieFrom(second) })).status).toBe(429)
  })

  it('applies RATE_LIMIT_PER_MINUTE and CIRCUIT_FAILURE_THRESHOLD', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '2')
    await send({ topic: 'x' })
    await send({ topic: 'x' })
    expect((await send({ topic: 'x' })).status).toBe(429)

    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '')
    vi.stubEnv('CIRCUIT_FAILURE_THRESHOLD', '2')
    await send({ topic: 'x' }, generator({ kind: 'failed' }), { ip: '10.3.0.1' })
    await send({ topic: 'x' }, generator({ kind: 'failed' }), { ip: '10.3.0.2' })
    expect((await send({ topic: 'x' }, undefined, { ip: '10.3.0.3' })).status).toBe(503)
  })
})

// These tests document the approved best-effort compromise (ARCHITECTURE §1.2):
// without a shared store the limits can be exceeded. They do not claim hard enforcement.
describe('best-effort limits (documented, not guaranteed)', () => {
  it('two parallel requests on the last allowed joke can both succeed (21 of 20)', async () => {
    const cookie = usageCookie({ successCount: 19 })
    const [a, b] = await Promise.all([
      send({ topic: 'x' }, undefined, { cookie, ip: '10.4.0.1' }),
      send({ topic: 'x' }, undefined, { cookie, ip: '10.4.0.2' }),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
  })

  it('replaying an older cookie brings back its older count', async () => {
    const old = usageCookie({ successCount: 1 })
    await send({ topic: 'x' }, undefined, { cookie: usageCookie({ successCount: 19 }) })
    const response = await send({ topic: 'x' }, undefined, { cookie: old, ip: '10.4.0.3' })
    expect((await response.json()).remainingToday).toBe(18)
  })

  it('each instance keeps its own global counter and circuit breaker', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('GLOBAL_DAILY_LIMIT', '1')
    const other = createUsageState(() => clock)

    await send({ topic: 'x' }, undefined, { ip: '10.5.0.1' })
    expect((await send({ topic: 'x' }, undefined, { ip: '10.5.0.2' })).status).toBe(429)
    const onOther = await handleJokeRequest(post({ topic: 'x' }, { ip: '10.5.0.3' }), {
      generateJoke: generator({ kind: 'joke', joke: 'x' }),
      state: other,
    })
    expect(onOther.status).toBe(200)

    vi.stubEnv('GLOBAL_DAILY_LIMIT', '')
    for (let i = 0; i < 5; i++) await send({ topic: 'x' }, generator({ kind: 'failed' }), { ip: `10.6.0.${i}` })
    expect(state.circuitBreaker.state()).toBe('open')
    expect(other.circuitBreaker.state()).toBe('closed')
  })
})

describe('request checks before any limit (ARCHITECTURE §2.9)', () => {
  const raw = (headers: Record<string, string>, body = '{"topic":"x"}') =>
    handleJokeRequest(
      new Request('http://localhost/api/jokes', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.7', ...headers },
        body,
      }),
      { generateJoke: generate, state },
    )
  const generate = generator({ kind: 'joke', joke: 'x' })

  it('rejects a foreign Origin, a non-JSON type and an oversized body without calling OpenAI or counting', async () => {
    for (let i = 0; i < 4; i++) {
      expect((await raw({ Origin: 'https://evil.example', 'Content-Type': 'application/json' })).status).toBe(403)
      expect((await raw({ 'Content-Type': 'application/json' })).status).toBe(403)
      expect((await raw({ Origin: 'http://localhost', 'Content-Type': 'text/plain' })).status).toBe(415)
      const big = JSON.stringify({ topic: 'x', previousJoke: 'א'.repeat(3000) })
      expect((await raw({ Origin: 'http://localhost', 'Content-Type': 'application/json' }, big)).status).toBe(413)
    }
    expect(generate).not.toHaveBeenCalled()
    // 16 rejected requests did not use up the 5-per-minute rate limit.
    expect((await send({ topic: 'x' })).status).toBe(200)
  })

  it('treats a forged cookie as no cookie: a new id at zero, while the IP rate limit still applies', async () => {
    const forged = `${USAGE_COOKIE_NAME}=${usageCookie({ successCount: 20 }).split('=')[1].replace(/.$/, 'A')}`
    for (let i = 0; i < 5; i++) await send({ topic: 'x' }, undefined, { ip: '10.7.0.1' })
    const response = await send({ topic: 'x' }, undefined, { cookie: forged, ip: '10.7.0.1' })
    expect(response.status).toBe(429)
    expect((await response.json()).code).toBe('RATE_LIMITED')

    const fresh = await send({ topic: 'x' }, undefined, { cookie: forged, ip: '10.7.0.2' })
    expect((await fresh.json()).remainingToday).toBe(19)
    const usage = readUsageCookie(new Request('http://x', { headers: { Cookie: cookieFrom(fresh)! } }), SECRET)
    expect(usage?.id).not.toBe('user-1')
  })
})

describe('operational logs (PRD FR-07)', () => {
  const lines = () =>
    [console.log, console.warn, console.error].flatMap((spy) =>
      vi.mocked(spy).mock.calls.map(([line]) => JSON.parse(String(line)) as Record<string, unknown>),
    )

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('writes exactly one joke_request line per request, with status, code, latency and circuit state', async () => {
    await send({ topic: 'x' })
    await send({ topic: '   ' })
    const requests = lines().filter((line) => line.event === 'joke_request')
    expect(requests).toHaveLength(2)
    expect(requests[0]).toMatchObject({ level: 'info', status: 200, code: 'OK', circuit: 'closed' })
    expect(requests[1]).toMatchObject({ status: 400, code: 'INVALID_TOPIC' })
    expect(typeof requests[0].latencyMs).toBe('number')
    expect(typeof requests[0].requestId).toBe('string')
  })

  it('uses the Vercel request id when present', async () => {
    const request = post({ topic: 'x' })
    request.headers.set('x-vercel-id', 'fra1::abc-123')
    await handleJokeRequest(request, { generateJoke: generator({ kind: 'joke', joke: 'x' }), state })
    expect(lines()[0].requestId).toBe('fra1::abc-123')
  })

  it('never logs the topic, the joke, the previous joke, the cookie, the anonymous id or the IP', async () => {
    const cookie = usageCookie({ id: 'anon-id-secret-42' })
    const outcomes: JokeOutcome[] = [
      { kind: 'joke', joke: 'בדיחה-סודית-777' },
      { kind: 'refused' },
      { kind: 'timeout' },
      { kind: 'failed' },
    ]
    for (const outcome of outcomes) {
      await send({ topic: 'נושא-סודי-123', previousJoke: 'קודמת-סודית-555' }, generator(outcome), {
        cookie,
        ip: '198.51.100.99',
      })
    }
    const written = JSON.stringify([console.log, console.warn, console.error].map((spy) => vi.mocked(spy).mock.calls))
    for (const secret of ['נושא-סודי-123', 'בדיחה-סודית-777', 'קודמת-סודית-555', 'anon-id-secret-42', '198.51.100.99']) {
      expect(written).not.toContain(secret)
    }
    expect(written).not.toContain(cookie.split('=')[1])
    expect(written).not.toContain(SECRET)
  })
})
