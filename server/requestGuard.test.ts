// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { guardJsonPost, MAX_BODY_BYTES } from './requestGuard.js'

type Options = { origin?: string | null; contentType?: string | null; body?: string; contentLength?: string }

const request = ({
  origin = 'https://bdichomat.example',
  contentType = 'application/json',
  body = '{"topic":"x"}',
  contentLength,
}: Options = {}) => {
  const headers: Record<string, string> = {}
  if (origin !== null) headers.Origin = origin
  if (contentType !== null) headers['Content-Type'] = contentType
  if (contentLength) headers['Content-Length'] = contentLength
  return new Request('https://bdichomat.example/api/jokes', { method: 'POST', headers, body })
}

const statusOf = async (options: Options) => {
  const result = await guardJsonPost(request(options))
  return result instanceof Response ? result.status : 200
}

// A JSON body of exactly `bytes` bytes (Hebrew letters are 2 bytes in UTF-8).
const bodyOfBytes = (bytes: number) => {
  const shell = '{"topic":""}'
  const room = bytes - shell.length
  return `{"topic":"${'א'.repeat(Math.floor(room / 2))}${'a'.repeat(room % 2)}"}`
}

describe('request guard (POST /api/jokes)', () => {
  it('accepts a same-origin JSON request and returns the parsed body', async () => {
    expect(await guardJsonPost(request())).toEqual({ body: { topic: 'x' } })
    expect(await statusOf({ contentType: 'application/json; charset=utf-8' })).toBe(200)
  })

  it.each([
    ['a missing Origin', null],
    ['a foreign Origin', 'https://evil.example'],
    ['the opaque "null" Origin', 'null'],
    ['another port', 'https://bdichomat.example:8443'],
    ['plain http', 'http://bdichomat.example'],
  ])('rejects %s with 403', async (_label, origin) => {
    const response = (await guardJsonPost(request({ origin }))) as Response
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN_ORIGIN' })
  })

  it.each([
    ['a missing Content-Type', null],
    ['text/plain', 'text/plain'],
    ['a form post', 'application/x-www-form-urlencoded'],
    ['a look-alike type', 'application/jsonp'],
  ])('rejects %s with 415', async (_label, contentType) => {
    expect(await statusOf({ contentType })).toBe(415)
  })

  it('accepts a body of exactly the limit and rejects one byte more, with or without Content-Length', async () => {
    expect(new TextEncoder().encode(bodyOfBytes(MAX_BODY_BYTES)).length).toBe(MAX_BODY_BYTES)
    expect(await statusOf({ body: bodyOfBytes(MAX_BODY_BYTES) })).toBe(200)
    expect(await statusOf({ body: bodyOfBytes(MAX_BODY_BYTES + 1) })).toBe(413)
    expect(await statusOf({ contentLength: String(MAX_BODY_BYTES + 1) })).toBe(413)
  })

  it('rejects broken JSON with 400', async () => {
    expect(await statusOf({ body: '{oops' })).toBe(400)
  })
})
