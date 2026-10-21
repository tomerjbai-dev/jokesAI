// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { clientIp, createRateLimiter, rateKeys } from './rateLimiter.js'

const setup = () => {
  let clock = 0
  const limiter = createRateLimiter(() => clock)
  return { limiter, advance: (ms: number) => (clock += ms) }
}

describe('rate limiter (one instance)', () => {
  it('allows 5 per minute, blocks the 6th with the right wait, and frees up after the window', () => {
    const { limiter, advance } = setup()
    const keys = ['id:a']
    for (let i = 0; i < 5; i++) {
      expect(limiter.peek(keys, 5)).toEqual({ allowed: true })
      limiter.record(keys)
      advance(1000)
    }
    // First attempt was at 0s, now is 5s: the slot frees at 60s.
    expect(limiter.peek(keys, 5)).toEqual({ allowed: false, retryAfterSeconds: 55 })
    advance(55_000)
    expect(limiter.peek(keys, 5)).toEqual({ allowed: true })
  })

  it('blocks when any key is over the limit (IP stays after a new cookie id)', () => {
    const { limiter } = setup()
    for (let i = 0; i < 5; i++) limiter.record(['id:old', 'ip:1.2.3.4'])
    expect(limiter.peek(['id:new', 'ip:1.2.3.4'], 5).allowed).toBe(false)
    expect(limiter.peek(['id:new', 'ip:5.6.7.8'], 5).allowed).toBe(true)
  })

  it('peek does not record', () => {
    const { limiter } = setup()
    for (let i = 0; i < 10; i++) limiter.peek(['id:a'], 5)
    expect(limiter.size()).toBe(0)
  })

  it('cleans up stale keys when the map grows', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i <= 10_000; i++) limiter.record([`id:${i}`])
    advance(61_000)
    limiter.record(['id:fresh'])
    expect(limiter.size()).toBe(1)
  })
})

describe('client IP', () => {
  const request = (headers: Record<string, string>) => new Request('http://x', { headers })

  it('takes the first x-forwarded-for address, then x-real-ip', () => {
    expect(clientIp(request({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(request({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3')
    expect(clientIp(request({}))).toBeNull()
  })

  it('counts by id only when no IP is known', () => {
    expect(rateKeys('a', null)).toEqual(['id:a'])
    expect(rateKeys('a', '1.1.1.1')).toEqual(['id:a', 'ip:1.1.1.1'])
  })
})
