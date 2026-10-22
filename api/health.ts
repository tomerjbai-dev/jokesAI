import { handleHealthRequest } from '../server/healthHandler.js'

// Vercel routes GET /api/health here; other methods get 405 automatically.
export function GET(): Response {
  return handleHealthRequest()
}
