import { validateTopic, WHITESPACE_TOPIC_MESSAGE } from '../shared/topic.js'
import { GENERAL_FAILURE_MESSAGE, REFUSAL_MESSAGE, type ErrorBody } from './errors.js'
import { generateJoke as defaultGenerateJoke } from './jokeService.js'

const MAX_PREVIOUS_JOKE_LENGTH = 500

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function error(status: number, body: ErrorBody): Response {
  return json(status, body)
}

export async function handleJokeRequest(
  request: Request,
  generateJoke: typeof defaultGenerateJoke = defaultGenerateJoke,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }
  if (typeof body !== 'object' || body === null) {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }

  const { topic = '', previousJoke } = body as { topic?: unknown; previousJoke?: unknown }
  if (typeof topic !== 'string') {
    return error(400, { code: 'INVALID_TOPIC', message: GENERAL_FAILURE_MESSAGE })
  }

  // Invalid input is rejected here, before any OpenAI call.
  const check = validateTopic(topic)
  if (!check.ok) {
    const message = check.reason === 'whitespace' ? WHITESPACE_TOPIC_MESSAGE : GENERAL_FAILURE_MESSAGE
    return error(400, { code: 'INVALID_TOPIC', message })
  }

  const outcome = await generateJoke({
    topic: topic.trim(),
    previousJoke: typeof previousJoke === 'string' ? previousJoke.slice(0, MAX_PREVIOUS_JOKE_LENGTH) : undefined,
  })

  if (outcome.kind === 'joke') return json(200, { joke: outcome.joke })
  if (outcome.kind === 'refused') return error(422, { code: 'UNSUPPORTED_TOPIC', message: REFUSAL_MESSAGE })
  return error(500, { code: 'INTERNAL_ERROR', message: GENERAL_FAILURE_MESSAGE })
}
