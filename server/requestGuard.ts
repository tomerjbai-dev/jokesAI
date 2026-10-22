import { GENERAL_FAILURE_MESSAGE, type ErrorCode } from './errors.js'
import { json } from './http.js'

// A topic (100 chars) plus a previous joke (500 chars) in Hebrew and emoji stays far below this.
export const MAX_BODY_BYTES = 4096

// Checks for POST /api/jokes that run before the cookie, the limits or OpenAI (ARCHITECTURE §2.9):
// same-origin Origin (CSRF), a JSON Content-Type and a size cap. Returns the parsed body or an error response.
// Rejections here are not counted toward the rate limit.
export async function guardJsonPost(request: Request): Promise<{ body: unknown } | Response> {
  const fail = (status: number, code: ErrorCode) => json(status, { code, message: GENERAL_FAILURE_MESSAGE })

  // Browsers always send Origin on POST; a missing or foreign one is not our page.
  if (request.headers.get('origin') !== new URL(request.url).origin) return fail(403, 'FORBIDDEN_ORIGIN')

  const contentType = request.headers.get('content-type') ?? ''
  if (!/^application\/json\s*(;|$)/i.test(contentType)) return fail(415, 'UNSUPPORTED_MEDIA_TYPE')

  // Content-Length can be missing (chunked), so the body itself is measured too.
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, 'PAYLOAD_TOO_LARGE')
  const text = await request.text()
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return fail(413, 'PAYLOAD_TOO_LARGE')

  try {
    return { body: JSON.parse(text) as unknown }
  } catch {
    return fail(400, 'INVALID_TOPIC')
  }
}
