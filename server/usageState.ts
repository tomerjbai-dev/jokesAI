import { createCircuitBreaker } from './circuitBreaker.js'
import { createRateLimiter } from './rateLimiter.js'

// Temporary in-memory state of one Function instance: the global success estimate, the rate limiter
// and the circuit breaker. Parallel instances each have their own copy (best effort, no shared store).

export type UsageState = ReturnType<typeof createUsageState>

export function createUsageState(now: () => number = Date.now) {
  return {
    now,
    globalUsage: { dayKey: '', successCount: 0 },
    rateLimiter: createRateLimiter(now),
    circuitBreaker: createCircuitBreaker(now),
  }
}

export const defaultUsageState = createUsageState()

// The global counter starts over when the day changes.
export function globalCount(state: UsageState, today: string): number {
  if (state.globalUsage.dayKey !== today) state.globalUsage = { dayKey: today, successCount: 0 }
  return state.globalUsage.successCount
}
