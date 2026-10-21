// Topic rules shared by the client and the server. Keep this file free of imports.

export const MAX_TOPIC_LENGTH = 100

export const WHITESPACE_TOPIC_MESSAGE = 'רווחים זה נחמד, אבל תנו לנו נושא אמיתי 😅'

export type TopicCheck = { ok: true } | { ok: false; reason: 'whitespace' | 'too-long' }

// An empty topic is valid (general joke); whitespace-only input is not.
export function validateTopic(topic: string): TopicCheck {
  if (topic.length > MAX_TOPIC_LENGTH) return { ok: false, reason: 'too-long' }
  if (topic.length > 0 && topic.trim() === '') return { ok: false, reason: 'whitespace' }
  return { ok: true }
}
