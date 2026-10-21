export const GENERAL_FAILURE_MESSAGE = 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'
export const REFUSAL_MESSAGE = 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!'
export const TIMEOUT_MESSAGE = 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'

export type ErrorCode = 'INVALID_TOPIC' | 'UNSUPPORTED_TOPIC' | 'AI_TIMEOUT' | 'INTERNAL_ERROR'

export type ErrorBody = { code: ErrorCode; message: string }
