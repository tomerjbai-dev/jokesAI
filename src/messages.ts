// UI copy for failures, verbatim from the PRD (FR-05 table and the offline screen).
export const GENERAL_FAILURE_MESSAGE = 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'
export const TIMEOUT_MESSAGE = 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'
export const PAUSED_MESSAGE = 'הקומיקאי לוקח הפסקה קצרה ☕ אפשר לנסות שוב בעוד כמה דקות.'
export const CONNECTION_DROPPED_MESSAGE = 'החיבור נקטע באמצע הבדיחה 📡 אפשר לנסות שוב.'
export const REFUSAL_MESSAGE = 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!'
export const OFFLINE_MESSAGE = 'אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.'
export const PERSONAL_QUOTA_MESSAGE = 'נגמרו הבדיחות להיום! חזרו מחר לעוד צחוקים 😄'
export const GLOBAL_QUOTA_MESSAGE = 'הקומיקאי שלנו סיים להיום 🎤😴 נגמרו הבדיחות, נתראה מחר!'
export const RATE_LIMIT_MESSAGE = 'רגע, גם לקומיקאי מגיע לנשום 😅'

// The daily balance line (DESIGN §1.2).
export const remainingText = (count: number) => (count === 1 ? 'נשארה בדיחה אחת היום' : `נשארו ${count} בדיחות היום`)

// The PRD asks for a countdown but does not word it; this copy is ours.
export const countdownText = (seconds: number) =>
  seconds === 1 ? 'אפשר לנסות שוב בעוד שנייה' : `אפשר לנסות שוב בעוד ${seconds} שניות`
