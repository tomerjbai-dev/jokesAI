export const GENERAL_FAILURE_MESSAGE = 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'
export const REFUSAL_MESSAGE = 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!'
export const TIMEOUT_MESSAGE = 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'
export const PAUSED_MESSAGE = 'הקומיקאי לוקח הפסקה קצרה ☕ אפשר לנסות שוב בעוד כמה דקות.'
export const PERSONAL_QUOTA_MESSAGE = 'נגמרו הבדיחות להיום! חזרו מחר לעוד צחוקים 😄'
export const GLOBAL_QUOTA_MESSAGE = 'הקומיקאי שלנו סיים להיום 🎤😴 נגמרו הבדיחות, נתראה מחר!'
export const RATE_LIMIT_MESSAGE = 'רגע, גם לקומיקאי מגיע לנשום 😅'

export type ErrorCode =
  | 'INVALID_TOPIC'
  | 'UNSUPPORTED_TOPIC'
  | 'RATE_LIMITED'
  | 'PERSONAL_QUOTA_EXCEEDED'
  | 'GLOBAL_QUOTA_EXCEEDED'
  | 'AI_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'INTERNAL_ERROR'

export type ErrorBody = { code: ErrorCode; message: string; retryAfterSeconds?: number }
