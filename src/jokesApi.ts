import {
  CONNECTION_DROPPED_MESSAGE,
  GENERAL_FAILURE_MESSAGE,
  GLOBAL_QUOTA_MESSAGE,
  PAUSED_MESSAGE,
  PERSONAL_QUOTA_MESSAGE,
  RATE_LIMIT_MESSAGE,
  REFUSAL_MESSAGE,
  TIMEOUT_MESSAGE,
} from './messages.ts'

// Safety net in case the server never answers; the server itself gives up after 28 seconds.
export const CLIENT_TIMEOUT_MS = 35000
// Used when a rate-limit reply does not say how long to wait.
const DEFAULT_RETRY_AFTER_SECONDS = 60

// A limit the server detected: generation stays disabled until it clears.
export type Block = { kind: 'personal' } | { kind: 'global' } | { kind: 'rate'; retryAfterSeconds: number }

export type JokeResult =
  | { ok: true; joke: string; remainingToday?: number }
  | { ok: false; message: string; block?: Block }
  | { ok: false; aborted: true }

export type Status = {
  remainingToday: number
  dailyLimit: number
  globalAvailableEstimate: boolean
  retryAfterSeconds?: number
}

const MESSAGE_BY_CODE: Record<string, string> = {
  AI_TIMEOUT: TIMEOUT_MESSAGE,
  AI_UNAVAILABLE: PAUSED_MESSAGE,
  UNSUPPORTED_TOPIC: REFUSAL_MESSAGE,
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

function retryAfter(value: unknown): number {
  return typeof value === 'number' && value > 0 ? Math.ceil(value) : DEFAULT_RETRY_AFTER_SECONDS
}

// Never throws: every outcome is returned as a JokeResult.
// Aborting `signal` (refresh, close, leaving the screen) resolves as `aborted`, with no message to show.
export async function requestJoke(topic: string, previousJoke?: string, signal?: AbortSignal): Promise<JokeResult> {
  const controller = new AbortController()
  let timedOut = false
  // A plain timer (not AbortSignal.timeout) so tests can drive it with fake timers.
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, CLIENT_TIMEOUT_MS)
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort)

  try {
    const response = await fetch('/api/jokes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, previousJoke }),
      signal: controller.signal,
    })
    const data: unknown = await response.json().catch(() => null)
    const { joke, code, message, remainingToday, retryAfterSeconds } = (data ?? {}) as Record<string, unknown>

    if (response.ok && typeof joke === 'string' && joke.trim() !== '') {
      return isCount(remainingToday) ? { ok: true, joke, remainingToday } : { ok: true, joke }
    }
    if (code === 'PERSONAL_QUOTA_EXCEEDED') return { ok: false, message: PERSONAL_QUOTA_MESSAGE, block: { kind: 'personal' } }
    if (code === 'GLOBAL_QUOTA_EXCEEDED') return { ok: false, message: GLOBAL_QUOTA_MESSAGE, block: { kind: 'global' } }
    if (code === 'RATE_LIMITED') {
      return { ok: false, message: RATE_LIMIT_MESSAGE, block: { kind: 'rate', retryAfterSeconds: retryAfter(retryAfterSeconds) } }
    }
    if (typeof code === 'string' && code in MESSAGE_BY_CODE) return { ok: false, message: MESSAGE_BY_CODE[code] }
    // Input errors carry their own copy (e.g. the whitespace message).
    if (code === 'INVALID_TOPIC' && typeof message === 'string' && message !== '') return { ok: false, message }
    return { ok: false, message: GENERAL_FAILURE_MESSAGE }
  } catch {
    if (timedOut) return { ok: false, message: TIMEOUT_MESSAGE }
    if (controller.signal.aborted) return { ok: false, aborted: true }
    // fetch rejects only when the network fails mid-request.
    return { ok: false, message: CONNECTION_DROPPED_MESSAGE }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

// Never throws; null when the status is unknown (network error, no /api in `npm run dev`, bad reply).
export async function fetchStatus(): Promise<Status | null> {
  try {
    const response = await fetch('/api/status')
    if (!response.ok) return null
    const data = (await response.json()) as Record<string, unknown> | null
    if (!data || !isCount(data.remainingToday) || !isCount(data.dailyLimit)) return null
    const status: Status = {
      remainingToday: data.remainingToday,
      dailyLimit: data.dailyLimit,
      globalAvailableEstimate: data.globalAvailableEstimate !== false,
    }
    if (typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
      status.retryAfterSeconds = Math.ceil(data.retryAfterSeconds)
    }
    return status
  } catch {
    return null
  }
}
