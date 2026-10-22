import { json } from './http.js'

// GET /api/health: liveness only. No settings, cookie, logs or OpenAI call, so it cannot leak a secret.
export function handleHealthRequest(): Response {
  return json(200, { status: 'ok' })
}
