import { readConfig, type Config } from './config.js'
import { dayKey } from './dayKey.js'
import { GENERAL_FAILURE_MESSAGE } from './errors.js'
import { readUsageCookie, resolveUsage, serializeUsageCookie, type ResolvedUsage } from './usageCookie.js'
import type { UsageState } from './usageState.js'

export function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
}

export type RequestContext = {
  config: Config & { cookieSecret: string }
  today: string
} & ResolvedUsage

// Shared start of every /api handler: settings, today's day key and the verified cookie.
// Without a signing secret the cookie could be forged, so the request fails instead.
export function startRequest(request: Request, state: UsageState): RequestContext | Response {
  const config = readConfig()
  const { cookieSecret } = config
  if (!cookieSecret) {
    console.error('config missing: COOKIE_SIGNING_SECRET')
    return json(500, { code: 'INTERNAL_ERROR', message: GENERAL_FAILURE_MESSAGE })
  }
  const now = state.now()
  const today = dayKey(new Date(now), config.timeZone)
  const resolved = resolveUsage(readUsageCookie(request, cookieSecret), today, now)
  return { config: { ...config, cookieSecret }, today, ...resolved }
}

// Set-Cookie for a new id or a new day; a counter update is sent separately on success.
export function cookieHeader(context: RequestContext): Record<string, string> {
  return context.changed ? { 'Set-Cookie': serializeUsageCookie(context.usage, context.config.cookieSecret) } : {}
}
