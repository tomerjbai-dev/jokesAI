// Sliding one-minute window per key, in this Function instance's memory only (best effort).
// Keys are never logged: one of them holds the client's IP address.

const WINDOW_MS = 60_000
const MAX_KEYS = 10_000

export type RateCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number }

export type RateLimiter = ReturnType<typeof createRateLimiter>

export function createRateLimiter(now: () => number) {
  const windows = new Map<string, number[]>()

  const recent = (key: string, at: number): number[] => {
    const stamps = windows.get(key)
    if (!stamps) return []
    const fresh = stamps.filter((stamp) => stamp > at - WINDOW_MS)
    if (fresh.length === 0) windows.delete(key)
    else if (fresh.length !== stamps.length) windows.set(key, fresh)
    return fresh
  }

  const sweep = (at: number) => {
    for (const key of [...windows.keys()]) recent(key, at)
  }

  // Blocked when any key is at the limit; the wait is the longest of the blocked keys.
  const peek = (keys: string[], limit: number): RateCheck => {
    const at = now()
    let wait = 0
    for (const key of keys) {
      const stamps = recent(key, at)
      if (stamps.length >= limit) {
        const freeAt = stamps[stamps.length - limit] + WINDOW_MS
        wait = Math.max(wait, Math.max(1, Math.ceil((freeAt - at) / 1000)))
      }
    }
    return wait > 0 ? { allowed: false, retryAfterSeconds: wait } : { allowed: true }
  }

  const record = (keys: string[]) => {
    const at = now()
    if (windows.size > MAX_KEYS) sweep(at)
    for (const key of keys) windows.set(key, [...recent(key, at), at])
  }

  return { peek, record, size: () => windows.size }
}

// The first address in x-forwarded-for (set by Vercel), else x-real-ip; absent only in local runs.
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('x-real-ip')?.trim() || null
}

export function rateKeys(anonymousId: string, ip: string | null): string[] {
  return ip ? [`id:${anonymousId}`, `ip:${ip}`] : [`id:${anonymousId}`]
}
