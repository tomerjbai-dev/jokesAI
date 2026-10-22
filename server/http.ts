import { readConfig, type Config } from './config.js'
import { dayKey } from './dayKey.js'
import { readUsageCookie, resolveUsage, serializeUsageCookie, type ResolvedUsage } from './usageCookie.js'
import type { UsageState } from './usageState.js'

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export type RequestContext = { config: Config; today: string } & ResolvedUsage

// Shared start of every /api handler: settings, today's day key and the verified cookie.
export function startRequest(request: Request, state: UsageState): RequestContext {
  const config = readConfig()
  const now = state.now()
  const today = dayKey(new Date(now), config.timeZone)
  const resolved = resolveUsage(readUsageCookie(request, config.cookieSecret), today, now)
  return { config, today, ...resolved }
}

// Set-Cookie for a new id or a new day; a counter update is sent separately on success.
export function cookieHeader(context: RequestContext): Record<string, string> {
  return context.changed ? { 'Set-Cookie': serializeUsageCookie(context.usage, context.config.cookieSecret) } : {}
}
