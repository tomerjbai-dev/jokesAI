// Backend settings, read from the environment on every request so a change needs no code change.

export const DEFAULTS = {
  personalDailyLimit: 20,
  globalDailyLimit: 100,
  rateLimitPerMinute: 5,
  aiTimeoutMs: 28000,
  circuitFailureThreshold: 5,
  circuitOpenMs: 120000,
  timeZone: 'Asia/Jerusalem',
}

// A shorter secret would make the cookie signature easy to brute-force.
export const MIN_SECRET_LENGTH = 32

export type Config = typeof DEFAULTS & { cookieSecret: string | null }

// An empty, non-numeric or non-positive value falls back to the default.
function positiveInt(name: string, fallback: number): number {
  const value = Math.floor(Number(process.env[name]))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function timeZone(): string {
  const value = process.env.APP_TIMEZONE
  if (!value) return DEFAULTS.timeZone
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value })
    return value
  } catch {
    return DEFAULTS.timeZone
  }
}

export function readTimeoutMs(): number {
  return positiveInt('AI_TIMEOUT_MS', DEFAULTS.aiTimeoutMs)
}

export function readConfig(): Config {
  const secret = process.env.COOKIE_SIGNING_SECRET ?? ''
  return {
    personalDailyLimit: positiveInt('PERSONAL_DAILY_LIMIT', DEFAULTS.personalDailyLimit),
    globalDailyLimit: positiveInt('GLOBAL_DAILY_LIMIT', DEFAULTS.globalDailyLimit),
    rateLimitPerMinute: positiveInt('RATE_LIMIT_PER_MINUTE', DEFAULTS.rateLimitPerMinute),
    aiTimeoutMs: readTimeoutMs(),
    circuitFailureThreshold: positiveInt('CIRCUIT_FAILURE_THRESHOLD', DEFAULTS.circuitFailureThreshold),
    circuitOpenMs: positiveInt('CIRCUIT_OPEN_MS', DEFAULTS.circuitOpenMs),
    timeZone: timeZone(),
    cookieSecret: secret.length >= MIN_SECRET_LENGTH ? secret : null,
  }
}
