import {
  CONNECTION_DROPPED_MESSAGE,
  GENERAL_FAILURE_MESSAGE,
  PAUSED_MESSAGE,
  REFUSAL_MESSAGE,
  TIMEOUT_MESSAGE,
} from './messages.ts'

// Safety net in case the server never answers; the server itself gives up after 28 seconds.
export const CLIENT_TIMEOUT_MS = 35000

export type JokeResult = { ok: true; joke: string } | { ok: false; message: string } | { ok: false; aborted: true }

const MESSAGE_BY_CODE: Record<string, string> = {
  AI_TIMEOUT: TIMEOUT_MESSAGE,
  AI_UNAVAILABLE: PAUSED_MESSAGE,
  UNSUPPORTED_TOPIC: REFUSAL_MESSAGE,
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
    const { joke, code, message } = (data ?? {}) as { joke?: unknown; code?: unknown; message?: unknown }

    if (response.ok && typeof joke === 'string' && joke.trim() !== '') return { ok: true, joke }
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
