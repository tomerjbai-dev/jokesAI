// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BUILT_IN_COOKIE_SECRET, DEFAULTS, readConfig } from './config.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

const NAMES = [
  'PERSONAL_DAILY_LIMIT',
  'GLOBAL_DAILY_LIMIT',
  'RATE_LIMIT_PER_MINUTE',
  'AI_TIMEOUT_MS',
  'CIRCUIT_FAILURE_THRESHOLD',
  'CIRCUIT_OPEN_MS',
  'APP_TIMEZONE',
  'COOKIE_SIGNING_SECRET',
]

describe('readConfig', () => {
  it('uses the ARCHITECTURE defaults when nothing is set', () => {
    for (const name of NAMES) vi.stubEnv(name, '')
    expect(readConfig()).toEqual({ ...DEFAULTS, cookieSecret: BUILT_IN_COOKIE_SECRET })
    expect(DEFAULTS).toEqual({
      personalDailyLimit: 20,
      globalDailyLimit: 100,
      rateLimitPerMinute: 5,
      aiTimeoutMs: 28000,
      circuitFailureThreshold: 5,
      circuitOpenMs: 120000,
      timeZone: 'Asia/Jerusalem',
    })
  })

  it('reads custom values', () => {
    vi.stubEnv('PERSONAL_DAILY_LIMIT', '3')
    vi.stubEnv('GLOBAL_DAILY_LIMIT', '7')
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '2')
    vi.stubEnv('CIRCUIT_FAILURE_THRESHOLD', '4')
    vi.stubEnv('CIRCUIT_OPEN_MS', '1000')
    vi.stubEnv('APP_TIMEZONE', 'Europe/London')
    vi.stubEnv('COOKIE_SIGNING_SECRET', 'x'.repeat(32))
    expect(readConfig()).toMatchObject({
      personalDailyLimit: 3,
      globalDailyLimit: 7,
      rateLimitPerMinute: 2,
      circuitFailureThreshold: 4,
      circuitOpenMs: 1000,
      timeZone: 'Europe/London',
      cookieSecret: 'x'.repeat(32),
    })
  })

  it.each(['abc', '0', '-5'])('falls back to the default for %s', (value) => {
    vi.stubEnv('PERSONAL_DAILY_LIMIT', value)
    expect(readConfig().personalDailyLimit).toBe(20)
  })

  it('falls back to Israel time for an unknown time zone', () => {
    vi.stubEnv('APP_TIMEZONE', 'Not/AZone')
    expect(readConfig().timeZone).toBe('Asia/Jerusalem')
  })

  it.each(['', 'short'])('uses the built-in secret when the secret is %j', (value) => {
    vi.stubEnv('COOKIE_SIGNING_SECRET', value)
    expect(readConfig().cookieSecret).toBe(BUILT_IN_COOKIE_SECRET)
  })
})
