// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logEvent } from './log.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('structured logs', () => {
  it('writes one JSON line with a timestamp, level and event', () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => {})
    logEvent({ event: 'joke_request', requestId: 'r1', status: 200, code: 'OK', latencyMs: 12, circuit: 'closed' })
    const [line] = info.mock.calls[0]
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual({
      ts: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      level: 'info',
      event: 'joke_request',
      requestId: 'r1',
      status: 200,
      code: 'OK',
      latencyMs: 12,
      circuit: 'closed',
    })
  })

  it('writes errors and warnings to the matching console stream', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logEvent({ event: 'ai_error', errorName: 'APIError' })
    logEvent({ event: 'circuit_opened', failures: 5 })
    expect(JSON.parse(error.mock.calls[0][0])).toMatchObject({ level: 'error', event: 'ai_error' })
    expect(JSON.parse(warn.mock.calls[0][0])).toMatchObject({ level: 'warn', event: 'circuit_opened' })
  })
})
