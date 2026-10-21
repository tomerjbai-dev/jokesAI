import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_TIMEOUT_MS, fetchStatus, requestJoke } from '../jokesApi.ts'
import {
  CONNECTION_DROPPED_MESSAGE,
  GENERAL_FAILURE_MESSAGE,
  GLOBAL_QUOTA_MESSAGE,
  PAUSED_MESSAGE,
  PERSONAL_QUOTA_MESSAGE,
  RATE_LIMIT_MESSAGE,
  REFUSAL_MESSAGE,
  TIMEOUT_MESSAGE,
} from '../messages.ts'

const reply = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })),
  )

// A fetch that never answers on its own and rejects like the browser does when aborted.
const hangingFetch = () => {
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('requestJoke error mapping', () => {
  it('returns the joke on success', async () => {
    reply(200, { joke: 'בדיחה' })
    expect(await requestJoke('x')).toEqual({ ok: true, joke: 'בדיחה' })
  })

  it.each([
    ['504 AI_TIMEOUT', 504, { code: 'AI_TIMEOUT', message: 'm' }, TIMEOUT_MESSAGE],
    ['503 AI_UNAVAILABLE', 503, { code: 'AI_UNAVAILABLE', message: 'm' }, PAUSED_MESSAGE],
    ['422 UNSUPPORTED_TOPIC', 422, { code: 'UNSUPPORTED_TOPIC', message: 'm' }, REFUSAL_MESSAGE],
    ['500 INTERNAL_ERROR', 500, { code: 'INTERNAL_ERROR', message: 'm' }, GENERAL_FAILURE_MESSAGE],
    ['an unknown code', 502, { code: 'SOMETHING' }, GENERAL_FAILURE_MESSAGE],
    ['a non-JSON body', 502, '<html>Bad gateway</html>', GENERAL_FAILURE_MESSAGE],
    ['200 without a joke', 200, { joke: '  ' }, GENERAL_FAILURE_MESSAGE],
    ['400 with its own copy', 400, { code: 'INVALID_TOPIC', message: 'הודעת קלט' }, 'הודעת קלט'],
  ])('maps %s to its FR-05 message', async (_label, status, body, message) => {
    reply(status, body)
    expect(await requestJoke('x')).toEqual({ ok: false, message })
  })

  it('passes on the remaining balance after a success', async () => {
    reply(200, { joke: 'בדיחה', remainingToday: 7 })
    expect(await requestJoke('x')).toEqual({ ok: true, joke: 'בדיחה', remainingToday: 7 })
  })

  it.each([
    ['PERSONAL_QUOTA_EXCEEDED', {}, PERSONAL_QUOTA_MESSAGE, { kind: 'personal' }],
    ['GLOBAL_QUOTA_EXCEEDED', {}, GLOBAL_QUOTA_MESSAGE, { kind: 'global' }],
    ['RATE_LIMITED', { retryAfterSeconds: 42 }, RATE_LIMIT_MESSAGE, { kind: 'rate', retryAfterSeconds: 42 }],
    ['RATE_LIMITED without a wait', {}, RATE_LIMIT_MESSAGE, { kind: 'rate', retryAfterSeconds: 60 }],
  ])('maps 429 %s to its message and a block', async (label, extra, message, block) => {
    reply(429, { code: label.split(' ')[0], message: 'm', ...extra })
    expect(await requestJoke('x')).toEqual({ ok: false, message, block })
  })

  it('reports a dropped connection when the network fails mid-request', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await requestJoke('x')).toEqual({ ok: false, message: CONNECTION_DROPPED_MESSAGE })
  })
})

describe('requestJoke timeout and cancel', () => {
  it('gives up after 35 seconds with the timeout message, and not before', async () => {
    vi.useFakeTimers()
    hangingFetch()
    let result: unknown
    const pending = requestJoke('x').then((value) => (result = value))

    await vi.advanceTimersByTimeAsync(CLIENT_TIMEOUT_MS - 1)
    expect(result).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(CLIENT_TIMEOUT_MS).toBe(35000)
    expect(result).toEqual({ ok: false, message: TIMEOUT_MESSAGE })
  })

  it('an outside abort cancels the fetch and resolves silently', async () => {
    const fetchMock = hangingFetch()
    const controller = new AbortController()
    const pending = requestJoke('x', undefined, controller.signal)
    controller.abort()
    expect(await pending).toEqual({ ok: false, aborted: true })
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
  })
})

describe('fetchStatus', () => {
  it('returns the status', async () => {
    reply(200, { remainingToday: 3, dailyLimit: 20, globalAvailableEstimate: true, retryAfterSeconds: 12 })
    expect(await fetchStatus()).toEqual({
      remainingToday: 3,
      dailyLimit: 20,
      globalAvailableEstimate: true,
      retryAfterSeconds: 12,
    })
  })

  it.each([
    ['an error status', () => reply(500, { code: 'INTERNAL_ERROR' })],
    ['a non-JSON body', () => reply(404, 'Not found')],
    ['a malformed body', () => reply(200, { remainingToday: 'many' })],
    ['a network failure', () => vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('x'))))],
  ])('returns null on %s', async (_label, setup) => {
    setup()
    expect(await fetchStatus()).toBeNull()
  })
})
