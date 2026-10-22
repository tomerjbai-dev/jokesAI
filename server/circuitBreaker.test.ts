// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitBreaker } from './circuitBreaker.js'

const settings = { circuitFailureThreshold: 5, circuitOpenMs: 120_000 }

const setup = () => {
  let clock = 0
  const breaker = createCircuitBreaker(() => clock)
  return { breaker, advance: (ms: number) => (clock += ms) }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('circuit breaker (one instance)', () => {
  it('opens on the 5th consecutive failure', () => {
    const { breaker } = setup()
    for (let i = 0; i < 4; i++) breaker.recordFailure(settings)
    expect(breaker.acquire(settings)).toBe('allowed')
    breaker.recordFailure(settings)
    expect(breaker.acquire(settings)).toBe('rejected')
  })

  it('stays open for 120 seconds, then lets exactly one probe through', () => {
    const { breaker, advance } = setup()
    for (let i = 0; i < 5; i++) breaker.recordFailure(settings)
    advance(119_999)
    expect(breaker.acquire(settings)).toBe('rejected')
    advance(1)
    expect(breaker.acquire(settings)).toBe('probe')
    expect(breaker.acquire(settings)).toBe('rejected')
  })

  it('a successful probe closes it', () => {
    const { breaker, advance } = setup()
    for (let i = 0; i < 5; i++) breaker.recordFailure(settings)
    advance(120_000)
    breaker.acquire(settings)
    breaker.recordSuccess()
    expect(breaker.state()).toBe('closed')
    expect(breaker.acquire(settings)).toBe('allowed')
  })

  it('a failed probe opens it for another 120 seconds', () => {
    const { breaker, advance } = setup()
    for (let i = 0; i < 5; i++) breaker.recordFailure(settings)
    advance(120_000)
    breaker.acquire(settings)
    breaker.recordFailure(settings)
    advance(119_999)
    expect(breaker.acquire(settings)).toBe('rejected')
    advance(1)
    expect(breaker.acquire(settings)).toBe('probe')
  })

  it('a success in the middle resets the streak', () => {
    const { breaker } = setup()
    for (let i = 0; i < 4; i++) breaker.recordFailure(settings)
    breaker.recordSuccess()
    for (let i = 0; i < 4; i++) breaker.recordFailure(settings)
    expect(breaker.acquire(settings)).toBe('allowed')
  })

  it('a cancelled probe lets the next request probe', () => {
    const { breaker, advance } = setup()
    for (let i = 0; i < 5; i++) breaker.recordFailure(settings)
    advance(120_000)
    expect(breaker.acquire(settings)).toBe('probe')
    breaker.releaseProbe()
    expect(breaker.acquire(settings)).toBe('probe')
  })

  it('logs one structured line when it opens and one when a probe closes it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const info = vi.spyOn(console, 'log').mockImplementation(() => {})
    warn.mockClear()
    info.mockClear()
    const { breaker, advance } = setup()
    for (let i = 0; i < 6; i++) breaker.recordFailure(settings)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ level: 'warn', event: 'circuit_opened', failures: 5 })
    expect(breaker.state()).toBe('open')

    advance(120_000)
    expect(breaker.acquire(settings)).toBe('probe')
    expect(breaker.state()).toBe('half-open')
    breaker.recordSuccess()
    expect(breaker.state()).toBe('closed')
    expect(JSON.parse(info.mock.calls[0][0])).toMatchObject({ event: 'circuit_closed' })
  })
})
