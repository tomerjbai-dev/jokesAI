// Circuit breaker for the AI call (ARCHITECTURE §2.7). State lives in this Function instance only,
// so it is not global and resets whenever the instance is replaced.

export type CircuitSettings = { circuitFailureThreshold: number; circuitOpenMs: number }

export type Admission = 'allowed' | 'probe' | 'rejected'

export type CircuitBreaker = ReturnType<typeof createCircuitBreaker>

export function createCircuitBreaker(now: () => number) {
  let failures = 0
  let openedAt: number | null = null
  let probeInFlight = false

  const open = () => {
    openedAt = now()
    console.warn('circuit breaker opened')
  }

  const acquire = (settings: CircuitSettings): Admission => {
    if (openedAt === null) return 'allowed'
    if (now() - openedAt < settings.circuitOpenMs || probeInFlight) return 'rejected'
    // Half-open: exactly one request may test the service.
    probeInFlight = true
    return 'probe'
  }

  const recordSuccess = () => {
    failures = 0
    openedAt = null
    probeInFlight = false
  }

  const recordFailure = (settings: CircuitSettings) => {
    failures++
    const wasProbe = probeInFlight
    probeInFlight = false
    if (wasProbe || (openedAt === null && failures >= settings.circuitFailureThreshold)) open()
  }

  // The probe was cancelled by the client: neither a success nor a failure, so let the next request probe.
  const releaseProbe = () => {
    probeInFlight = false
  }

  const state = () => (openedAt === null ? 'closed' : probeInFlight ? 'half-open' : 'open')

  return { acquire, recordSuccess, recordFailure, releaseProbe, state }
}
