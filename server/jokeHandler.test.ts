// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleJokeRequest } from './jokeHandler.js'
import type { JokeOutcome, JokeRequest } from './jokeService.js'

const post = (body: unknown) =>
  new Request('http://localhost/api/jokes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

const generator = (outcome: JokeOutcome) => vi.fn(async (_request: JokeRequest, ..._rest: unknown[]) => outcome)

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/jokes', () => {
  it('returns the joke with no-store caching', async () => {
    const generate = generator({ kind: 'joke', joke: 'בדיחה' })
    const response = await handleJokeRequest(post({ topic: ' חתולים ', previousJoke: 'ישנה' }), generate)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ joke: 'בדיחה' })
    expect(generate.mock.calls[0][0]).toEqual({ topic: 'חתולים', previousJoke: 'ישנה' })
  })

  it('generates a general joke for an empty or missing topic', async () => {
    const generate = generator({ kind: 'joke', joke: 'בדיחה' })
    await handleJokeRequest(post({ topic: '' }), generate)
    await handleJokeRequest(post({}), generate)
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
    const response = await handleJokeRequest(post(body), generate)
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('INVALID_TOPIC')
    expect(generate).not.toHaveBeenCalled()
  })

  it('returns the whitespace message for whitespace-only input', async () => {
    const response = await handleJokeRequest(post({ topic: ' ' }), generator({ kind: 'failed' }))
    expect((await response.json()).message).toBe('רווחים זה נחמד, אבל תנו לנו נושא אמיתי 😅')
  })

  it('maps a refusal to 422 UNSUPPORTED_TOPIC', async () => {
    const response = await handleJokeRequest(post({ topic: 'x' }), generator({ kind: 'refused' }))
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      code: 'UNSUPPORTED_TOPIC',
      message: 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!',
    })
  })

  it('maps a timeout to 504 AI_TIMEOUT', async () => {
    const response = await handleJokeRequest(post({ topic: 'x' }), generator({ kind: 'timeout' }))
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
    await handleJokeRequest(request, generate)
    expect(generate).toHaveBeenCalledWith(expect.anything(), undefined, { signal: request.signal })
  })

  it('maps a failure to 500 without leaking the API key', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test-secret-123')
    const response = await handleJokeRequest(post({ topic: 'x' }), generator({ kind: 'failed' }))
    expect(response.status).toBe(500)
    const text = await response.text()
    expect(text).not.toContain('sk-test-secret-123')
    expect(JSON.parse(text)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.',
    })
  })
})
