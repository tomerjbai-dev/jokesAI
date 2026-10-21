// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dayKey } from './dayKey.js'

const israelDay = (iso: string) => dayKey(new Date(iso), 'Asia/Jerusalem')

describe('dayKey in Israel time', () => {
  it.each([
    // Winter time, UTC+2: midnight is 22:00 UTC.
    ['2026-01-15T21:59:59Z', '2026-01-15'],
    ['2026-01-15T22:00:00Z', '2026-01-16'],
    // Summer time, UTC+3: midnight is 21:00 UTC.
    ['2026-07-15T20:59:59Z', '2026-07-15'],
    ['2026-07-15T21:00:00Z', '2026-07-16'],
    // Summer time starts on Friday 27 March 2026 at 02:00; the next midnight is already UTC+3.
    ['2026-03-26T21:59:59Z', '2026-03-26'],
    ['2026-03-26T22:00:00Z', '2026-03-27'],
    ['2026-03-27T20:59:59Z', '2026-03-27'],
    ['2026-03-27T21:00:00Z', '2026-03-28'],
    // Winter time starts on Sunday 25 October 2026 at 02:00.
    ['2026-10-24T20:59:59Z', '2026-10-24'],
    ['2026-10-24T21:00:00Z', '2026-10-25'],
    ['2026-10-25T21:59:59Z', '2026-10-25'],
    ['2026-10-25T22:00:00Z', '2026-10-26'],
  ])('%s is %s', (iso, expected) => {
    expect(israelDay(iso)).toBe(expected)
  })
})
