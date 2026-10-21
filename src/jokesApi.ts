// Interim error copy until Milestone 3 maps every failure type to its own message.
export const GENERAL_FAILURE_MESSAGE = 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'

export type JokeResult = { ok: true; joke: string } | { ok: false; message: string }

// Never throws: every outcome is returned as a JokeResult.
export async function requestJoke(topic: string, previousJoke?: string): Promise<JokeResult> {
  try {
    const response = await fetch('/api/jokes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, previousJoke }),
    })
    const data: unknown = await response.json().catch(() => null)
    const { joke, message } = (data ?? {}) as { joke?: unknown; message?: unknown }

    if (response.ok && typeof joke === 'string' && joke.trim() !== '') return { ok: true, joke }
    return { ok: false, message: typeof message === 'string' && message !== '' ? message : GENERAL_FAILURE_MESSAGE }
  } catch {
    return { ok: false, message: GENERAL_FAILURE_MESSAGE }
  }
}
