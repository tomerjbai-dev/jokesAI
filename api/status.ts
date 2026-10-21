import { handleStatusRequest } from '../server/statusHandler.js'

// Vercel routes GET /api/status here; other methods get 405 automatically.
export function GET(request: Request): Response {
  return handleStatusRequest(request)
}
