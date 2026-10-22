// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleHealthRequest } from './healthHandler.js'

describe('GET /api/health', () => {
  it('answers 200 ok without caching or a cookie', async () => {
    const response = handleHealthRequest()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
