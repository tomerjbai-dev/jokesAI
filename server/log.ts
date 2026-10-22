// Structured operational logs (PRD FR-07, ARCHITECTURE §2.10): one JSON line per event.
// The event type is a closed union, so a topic, a joke, a cookie, an id or an IP cannot be passed in.

export type CircuitStateName = 'closed' | 'open' | 'half-open'

export type LogEvent =
  | {
      event: 'joke_request'
      requestId: string
      status: number
      code: string
      latencyMs: number
      circuit: CircuitStateName
    }
  | { event: 'circuit_opened'; failures: number }
  | { event: 'circuit_closed' }
  | { event: 'ai_error'; errorName: string }

type Level = 'info' | 'warn' | 'error'

const LEVELS: Record<LogEvent['event'], Level> = {
  joke_request: 'info',
  circuit_opened: 'warn',
  circuit_closed: 'info',
  ai_error: 'error',
}

export function logEvent(entry: LogEvent): void {
  const level = LEVELS[entry.event]
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...entry })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}
