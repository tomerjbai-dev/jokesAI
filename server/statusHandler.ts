import { cookieHeader, json, startRequest } from './http.js'
import { clientIp, rateKeys } from './rateLimiter.js'
import { defaultUsageState, globalCount, type UsageState } from './usageState.js'

export type StatusBody = {
  remainingToday: number
  dailyLimit: number
  // A hint from this Function instance only, never an authoritative global state.
  globalAvailableEstimate: boolean
  retryAfterSeconds?: number
}

// GET /api/status: estimated personal balance and local limits. Not rate limited; never calls OpenAI.
export function handleStatusRequest(request: Request, deps: { state?: UsageState } = {}): Response {
  const { state = defaultUsageState } = deps
  const context = startRequest(request, state)
  const { config, today, usage } = context

  const body: StatusBody = {
    remainingToday: Math.max(0, config.personalDailyLimit - usage.successCount),
    dailyLimit: config.personalDailyLimit,
    globalAvailableEstimate: globalCount(state, today) < config.globalDailyLimit,
  }
  const rate = state.rateLimiter.peek(rateKeys(usage.id, clientIp(request)), config.rateLimitPerMinute)
  if (!rate.allowed) body.retryAfterSeconds = rate.retryAfterSeconds

  return json(200, body, cookieHeader(context))
}
