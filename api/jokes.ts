import { handleJokeRequest } from '../server/jokeHandler.js'

// Vercel routes POST /api/jokes here; other methods get 405 automatically.
export function POST(request: Request): Promise<Response> {
  return handleJokeRequest(request)
}
