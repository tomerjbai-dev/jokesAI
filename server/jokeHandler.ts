import { validateTopic, WHITESPACE_TOPIC_MESSAGE } from '../shared/topic.js'
import {
  GENERAL_FAILURE_MESSAGE,
  GLOBAL_QUOTA_MESSAGE,
  PAUSED_MESSAGE,
  PERSONAL_QUOTA_MESSAGE,
  RATE_LIMIT_MESSAGE,
  REFUSAL_MESSAGE,
  TIMEOUT_MESSAGE,
  type ErrorBody,
} from './errors.js'
import { cookieHeader, json, startRequest } from './http.js'
import { generateJoke as defaultGenerateJoke } from './jokeService.js'
import { clientIp, rateKeys } from './rateLimiter.js'
import { serializeUsageCookie } from './usageCookie.js'
import { defaultUsageState, globalCount, type UsageState } from './usageState.js'

const MAX_PREVIOUS_JOKE_LENGTH = 500

export type JokeHandlerDeps = { generateJoke?: typeof defaultGenerateJoke; state?: UsageState }

// All limits below are best effort: they hold within one Function instance and one cookie,
// not across parallel requests, replayed cookies or other instances (ARCHITECTURE §2.5).
export async function handleJokeRequest(request: Request, deps: JokeHandlerDeps = {}): Promise<Response> {
  const { generateJoke = defaultGenerateJoke, state = defaultUsageState } = deps
  const context = startRequest(request, state)
  if (context instanceof Response) return context
  const { config, today, usage } = context
  const error = (status: number, body: ErrorBody, headers: Record<string, string> = {}) =>
    json(status, body, { ...cookieHeader(context), ...headers })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }
  if (typeof body !== 'object' || body === null) {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }

  const { topic = '', previousJoke } = body as { topic?: unknown; previousJoke?: unknown }
  if (typeof topic !== 'string') {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }

  // Invalid input is rejected here, before any limit is counted or OpenAI is called.
  const check = validateTopic(topic)
  if (!check.ok) {
    const message = check.reason === 'whitespace' ? WHITESPACE_TOPIC_MESSAGE : GENERAL_FAILURE_MESSAGE
    return error(400, { code: 'INVALID_TOPIC', message })
  }

  if (usage.successCount >= config.personalDailyLimit) {
    return error(429, { code: 'PERSONAL_QUOTA_EXCEEDED', message: PERSONAL_QUOTA_MESSAGE })
  }
  if (globalCount(state, today) >= config.globalDailyLimit) {
    return error(429, { code: 'GLOBAL_QUOTA_EXCEEDED', message: GLOBAL_QUOTA_MESSAGE })
  }

  // Counted by cookie id and by IP, so deleting the cookie does not reset it. The IP is never logged.
  const keys = rateKeys(usage.id, clientIp(request))
  const rate = state.rateLimiter.peek(keys, config.rateLimitPerMinute)
  if (!rate.allowed) {
    return error(
      429,
      { code: 'RATE_LIMITED', message: RATE_LIMIT_MESSAGE, retryAfterSeconds: rate.retryAfterSeconds },
      { 'Retry-After': String(rate.retryAfterSeconds) },
    )
  }
  // From here the attempt counts toward the rate limit even if it fails later.
  state.rateLimiter.record(keys)

  const admission = state.circuitBreaker.acquire(config)
  if (admission === 'rejected') return error(503, { code: 'AI_UNAVAILABLE', message: PAUSED_MESSAGE })

  // request.signal fires when the client disconnects, so the OpenAI call is cancelled too (best effort).
  const outcome = await generateJoke(
    {
      topic: topic.trim(),
      previousJoke: typeof previousJoke === 'string' ? previousJoke.slice(0, MAX_PREVIOUS_JOKE_LENGTH) : undefined,
    },
    undefined,
    { signal: request.signal },
  )

  if (outcome.kind === 'joke') {
    state.circuitBreaker.recordSuccess()
    // Counted as soon as the server has the joke; there is no delivery acknowledgement.
    const updated = { ...usage, successCount: usage.successCount + 1 }
    globalCount(state, today)
    state.globalUsage.successCount++
    return json(
      200,
      { joke: outcome.joke, remainingToday: Math.max(0, config.personalDailyLimit - updated.successCount) },
      { 'Set-Cookie': serializeUsageCookie(updated, config.cookieSecret) },
    )
  }
  if (outcome.kind === 'refused') {
    // A refusal is a valid answer from the service, not an infrastructure failure.
    state.circuitBreaker.recordSuccess()
    return error(422, { code: 'UNSUPPORTED_TOPIC', message: REFUSAL_MESSAGE })
  }
  if (outcome.kind === 'aborted') {
    if (admission === 'probe') state.circuitBreaker.releaseProbe()
    return error(500, { code: 'INTERNAL_ERROR', message: GENERAL_FAILURE_MESSAGE })
  }
  state.circuitBreaker.recordFailure(config)
  if (outcome.kind === 'timeout') return error(504, { code: 'AI_TIMEOUT', message: TIMEOUT_MESSAGE })
  return error(500, { code: 'INTERNAL_ERROR', message: GENERAL_FAILURE_MESSAGE })
}
