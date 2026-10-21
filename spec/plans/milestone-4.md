# תוכנית — Milestone 4: מכסות שימוש, Rate Limiting והגנות שירות

**מקורות:** `MILESTONES.md` (Milestone 4 + כללי ביצוע 5), `PRD.md` FR-03 / FR-04 / FR-05 / FR-07 וטבלת Edge Cases, `ARCHITECTURE.md` §1.2, §2.3, §2.4, §2.5, §2.6 (ספירת כשלים), §2.7, §2.9 (Cookie), §2.10 (Environment Variables), `DESIGN.md` §1.2, §1.3, §1.6.

**נקודת פתיחה (קוד קיים):**
- `server/jokeHandler.ts` — `handleJokeRequest(request, generateJoke)`; מחזיר `200 { joke }` / `400` / `422` / `504` / `500`. אין Cookie, אין מונים, אין `503`.
- `server/jokeService.ts` — `JokeOutcome` = `joke | refused | timeout | failed`; ביטול מצד הלקוח (`APIUserAbortError`) מוחזר כ-`failed`. `readTimeoutMs()` קורא `AI_TIMEOUT_MS`.
- `server/errors.ts` — נוסחי שרת ו-`ErrorCode`.
- `api/jokes.ts` — `POST` דק (ADR-4).
- `src/jokesApi.ts` — `requestJoke()` ממפה לפי `code` (ADR-9), כולל `AI_UNAVAILABLE` → `PAUSED_MESSAGE` שכבר קיים.
- `src/screens/Home.tsx` — אין שורת יתרה, אין השבתה בגלל הגבלה.

**מחוץ לטווח (Milestone 5 ואילך):** בדיקת `Origin` ו-`Content-Type`, הגבלת גודל Body, Security Headers / CSP, Structured Logs ומדדים, גימור עיצובי. `GET /api/health` מופיע ב-ARCHITECTURE §2.2 אך לא באף Milestone — לא ייבנה כאן.

**עיקרון מנחה:** הכול **Best Effort**. אין Database, Redis או מנעולים. בדיקות, שמות בדיקות והודעות לא יציגו את המכסות כאכיפה מובטחת (`MILESTONES.md` כלל 5).

---

## 1. Backend — הגדרות וזמן

### 1.1 `server/config.ts` (חדש)
`readConfig()` נקרא **בכל בקשה** (לא בטעינת המודול), כך ששינוי משתנה סביבה משפיע בלי שינוי קוד — וגם בבדיקות עם `vi.stubEnv`.

| משתנה | ברירת מחדל | הערה |
|---|---|---|
| `PERSONAL_DAILY_LIMIT` | `20` | |
| `GLOBAL_DAILY_LIMIT` | `100` | |
| `RATE_LIMIT_PER_MINUTE` | `5` | חלון של 60 שניות |
| `AI_TIMEOUT_MS` | `28000` | `readTimeoutMs()` עובר לכאן; `jokeService` משתמש בו |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` | |
| `CIRCUIT_OPEN_MS` | `120000` | |
| `APP_TIMEZONE` | `Asia/Jerusalem` | |
| `COOKIE_SIGNING_SECRET` | — (חובה) | אין ברירת מחדל |

- מספר ריק / לא מספרי / לא חיובי → ברירת המחדל (כמו `readTimeoutMs` היום). מספרים שלמים בלבד (`Math.floor`).
- `APP_TIMEZONE` לא תקין (`Intl` זורק) → `Asia/Jerusalem`.
- `COOKIE_SIGNING_SECRET` חסר או קצר מ-32 תווים → `null`. ה-Handlers מחזירים במקרה כזה `500 INTERNAL_ERROR` ולוג `config missing: COOKIE_SIGNING_SECRET` (בלי ערכים). **החלטה:** לא עובדים בלי Secret — אחרת אפשר לזייף Cookie.

### 1.2 `server/dayKey.ts` (חדש)
- `dayKey(now: Date, timeZone): string` → `YYYY-MM-DD` לפי `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })`. `Intl` מטפל בשעון קיץ/חורף בעצמו — אין חישוב היסטים ידני.
- אין צורך לחשב "כמה זמן עד חצות": ההשבתה בלקוח נמשכת עד שמצב השרת משתנה (סעיף 3.3).

---

## 2. Backend — מנגנוני ההגבלה

### 2.1 `server/usageCookie.ts` (חדש) — Cookie חתום
- **תוכן** (`AnonymousUsage`, §2.3): `{ id, dayKey, successCount, issuedAt }`.
  - `id` — `crypto.randomUUID()`; `issuedAt` — זמן ההנפקה (ms).
- **פורמט:** `base64url(JSON)` + `.` + `base64url(HMAC-SHA256(secret, החלק הראשון))`. `node:crypto` בלבד (`createHmac`, `timingSafeEqual`), בלי ספרייה חיצונית.
- **שם:** `bdichomat_usage`. **תכונות:** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000` (שנה). הערה: דפדפנים מקבלים `Secure` גם ב-`http://localhost`, ולכן זה עובד ב-`vercel dev`.
- `readUsageCookie(request, secret)` — מפענח את ה-Header `Cookie` ידנית. דוחה (מחזיר `null`) כש: אורך מעל 1024 תווים, חתימה שגויה, JSON לא תקין, או שדות מסוג לא נכון / `successCount` שלילי.
- `resolveUsage(cookie, today)`:
  - אין Cookie / לא תקין → מזהה חדש, `successCount: 0`, `isNew: true`.
  - `dayKey` של יום קודם → **אותו מזהה**, `successCount: 0`, `dayKey: today`.
- `serializeUsageCookie(usage, secret)` → ערך ל-`Set-Cookie`.
- **מתי שולחים `Set-Cookie`:** אחרי הצלחה (המונה המעודכן, §2.3), וגם כשהונפק מזהה חדש או שהיום התחלף — כדי שהמזהה יישמר ל-Rate Limiting. בכשל, סירוב או Timeout **לא** מעדכנים את המונה.
- המזהה מגיע **רק** מה-Cookie המאומת, אף פעם לא מגוף הבקשה (§2.9).

### 2.2 `server/rateLimiter.ts` (חדש) — 5 בקשות בדקה
- `createRateLimiter(now: () => number)`, `Map<string, number[]>` של חותמות זמן.
- מפתחות: `id:<anonymousId>` וגם `ip:<address>`. חריגה **באחד** מהם חוסמת (§2.5 סעיף 3).
- `check(keys, limit)` → `{ allowed: true } | { allowed: false, retryAfterSeconds }`, כש-`retryAfterSeconds = ceil((oldest + 60000 − now) / 1000)`, מינימום 1.
- `record(keys)` — רושם ניסיון. `peek(keys, limit)` — כמו `check` בלי לרשום (ל-`GET /api/status`).
- **ניקוי זיכרון:** בכל גישה מסירים חותמות ישנות מ-60 שניות; כשה-Map עובר 10,000 מפתחות — סריקה שמוחקת מפתחות שכל החותמות שלהם ישנות.
- **כתובת IP:** הערך הראשון ב-`x-forwarded-for`, אחרת `x-real-ip`. אם אין (קורה רק מקומית) — סופרים לפי המזהה בלבד. **הכתובת לא נכתבת לשום לוג** (FR-04).

### 2.3 `server/circuitBreaker.ts` (חדש) — לפי §2.7
- `createCircuitBreaker(now: () => number)`, מצב: `failures`, `openedAt`, `probeInFlight`.
- `acquire(config)` → `'allowed' | 'probe' | 'rejected'`:
  - `closed` → `allowed`.
  - `open` ועוד לא עברו `CIRCUIT_OPEN_MS` → `rejected`.
  - עברו → `half-open`: הבקשה הראשונה מקבלת `probe` (ו-`probeInFlight = true`); כל השאר `rejected` עד שהבדיקה מסתיימת.
- `recordSuccess()` → `failures = 0`, סגור.
- `recordFailure(config)` → `failures++`; אם זו הייתה בדיקה, או `failures >= CIRCUIT_FAILURE_THRESHOLD` → `open` מחדש (`openedAt = now`).
- `releaseProbe()` — כשהבדיקה בוטלה ע"י הלקוח: לא הצלחה ולא כשל; משחרר את `probeInFlight` כדי שבקשה הבאה תהיה בדיקה.
- כשהמנגנון נפתח: `console.warn('circuit breaker opened')` — בלי נתוני משתמש.

### 2.4 `server/usageState.ts` (חדש) — State של Instance
- `createUsageState(now = Date.now)` מחזיר: `globalUsage { dayKey, successCount }`, `rateLimiter`, `circuitBreaker`, `now`.
- מופע ברירת מחדל ברמת המודול (`defaultUsageState`) — זה ה-State ה"זמני בזיכרון" של אותו Function Instance. הבדיקות יוצרות State חדש לכל בדיקה, ושני States נפרדים מדמים שני Instances.
- המונה הגלובלי מתאפס כש-`dayKey` של היום שונה מזה שבמונה.

### 2.5 `server/jokeService.ts`
- `JokeOutcome` מקבל סוג נוסף `{ kind: 'aborted' }` עבור `APIUserAbortError` (במקום `failed`), כדי שביטול של הלקוח **לא** ייספר ככשל ב-Circuit Breaker.
- שימוש ב-`readConfig().aiTimeoutMs` במקום `readTimeoutMs()` (או ש-`readTimeoutMs` ייצא מ-`config.ts` — מה שפשוט יותר).

### 2.6 `server/errors.ts`
- `ErrorCode` מורחב: `RATE_LIMITED`, `PERSONAL_QUOTA_EXCEEDED`, `GLOBAL_QUOTA_EXCEEDED`, `AI_UNAVAILABLE`.
- `ErrorBody` מקבל `retryAfterSeconds?: number`.
- נוסחים חדשים (מילולית מה-PRD): `PERSONAL_QUOTA_MESSAGE`, `GLOBAL_QUOTA_MESSAGE`, `RATE_LIMIT_MESSAGE`, `PAUSED_MESSAGE`.

### 2.7 `server/jokeHandler.ts` — סדר הבדיקות ב-`POST /api/jokes`
חתימה חדשה: `handleJokeRequest(request, deps = {})` כש-`deps = { generateJoke?, state? }` (ברירות מחדל: השירות האמיתי ו-`defaultUsageState`).

1. `readConfig()`; אין Secret → `500`.
2. פענוח JSON ו-Validation (קיים) → `400`. **לא** נספר ב-Rate Limiting.
3. קריאת ה-Cookie ו-`resolveUsage` לפי `dayKey` של היום.
4. **מכסה אישית:** `successCount >= PERSONAL_DAILY_LIMIT` → `429 PERSONAL_QUOTA_EXCEEDED`.
5. **מכסה גלובלית (של ה-Instance):** `globalUsage.successCount >= GLOBAL_DAILY_LIMIT` → `429 GLOBAL_QUOTA_EXCEEDED`.
6. **Rate Limiting:** `check` → אם חסום: `429 RATE_LIMITED` עם `retryAfterSeconds` בגוף וגם Header `Retry-After`. אחרת `record` — מעכשיו הניסיון נספר, גם אם ייכשל בהמשך (§2.5 סעיף 3).
7. **Circuit Breaker:** `acquire` → `rejected` → `503 AI_UNAVAILABLE` **בלי קריאה ל-OpenAI**.
8. קריאה ל-`generateJoke` (עם `request.signal`, קיים).
9. לפי התוצאה:
   | תוצאה | Circuit Breaker | מונים | תשובה |
   |---|---|---|---|
   | `joke` | `recordSuccess` | אישי +1 (Cookie), גלובלי +1 | `200 { joke, remainingToday }` + `Set-Cookie` |
   | `refused` | `recordSuccess`¹ | ללא שינוי | `422 UNSUPPORTED_TOPIC` |
   | `timeout` | `recordFailure` | ללא שינוי | `504 AI_TIMEOUT` |
   | `failed` | `recordFailure` | ללא שינוי | `500 INTERNAL_ERROR` |
   | `aborted` | `releaseProbe` אם זו הייתה בדיקה | ללא שינוי | `500 INTERNAL_ERROR` (אין מי שיקבל) |

   ¹ סירוב הוא תשובה תקינה של השירות — הוא לא נספר ככשל (§2.6), והוא כן מוכיח שהשירות עונה, ולכן מאפס את רצף הכשלים וסוגר בדיקת `half-open`.
- `remainingToday = max(0, PERSONAL_DAILY_LIMIT − successCount)` (אם הוקטנה המגבלה — 0, לא מספר שלילי).
- בתשובות `4xx/5xx` נשלח `Set-Cookie` רק כשהונפק מזהה חדש / התחלף יום (סעיף 2.1), בלי שינוי מונה.
- כל התשובות `Cache-Control: no-store` (קיים).
- **אין** ספירה של בדיחה לפני שהשרת קיבל אותה בהצלחה, ואין מנגנון אישור קבלה מהלקוח.

### 2.8 `server/statusHandler.ts` (חדש) + `api/status.ts` (חדש)
- `api/status.ts` — `export function GET(request)` דק, כמו `api/jokes.ts`.
- `handleStatusRequest(request, deps = {})` מחזיר `200`:
  ```json
  { "remainingToday": 17, "dailyLimit": 20, "globalAvailableEstimate": true, "retryAfterSeconds": 42 }
  ```
  - `remainingToday` לפי ה-Cookie (או `dailyLimit` אם אין Cookie).
  - `globalAvailableEstimate` = המונה הגלובלי של ה-Instance מתחת למגבלה (רמז בלבד, §2.4).
  - `retryAfterSeconds` — רק אם `peek` מראה שהמשתמש חסום כרגע (לפי מזהה או IP).
  - `Set-Cookie` כשהונפק מזהה חדש / התחלף יום. `Cache-Control: no-store`. אין Secret → `500`.
- לא נספר ב-Rate Limiting ולא קורא ל-OpenAI.

### 2.9 `vercel.json`
- אין שינוי נדרש (`api/status.ts` מקבל את ברירות המחדל). לוודא ש-`vercel dev` מגיש את `GET /api/status`.

### 2.10 `.env.example`
להוסיף (בלי ערכים): `COOKIE_SIGNING_SECRET`, `PERSONAL_DAILY_LIMIT`, `GLOBAL_DAILY_LIMIT`, `RATE_LIMIT_PER_MINUTE`, `CIRCUIT_FAILURE_THRESHOLD`, `CIRCUIT_OPEN_MS`, `APP_TIMEZONE`.
- **המשתמש צריך להוסיף ל-`.env` ערך ל-`COOKIE_SIGNING_SECRET`** (חובה; בלעדיו יצירת בדיחה תחזיר שגיאה). אתן פקודה אחת שמייצרת מחרוזת אקראית להעתקה:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- את שאר המשתנים אפשר להשאיר ריקים — ברירות המחדל לפי ARCHITECTURE §2.5.

---

## 3. Frontend

### 3.1 `src/messages.ts`
להוסיף (מילולית מה-PRD):
- `PERSONAL_QUOTA_MESSAGE = 'נגמרו הבדיחות להיום! חזרו מחר לעוד צחוקים 😄'`
- `GLOBAL_QUOTA_MESSAGE = 'הקומיקאי שלנו סיים להיום 🎤😴 נגמרו הבדיחות, נתראה מחר!'`
- `RATE_LIMIT_MESSAGE = 'רגע, גם לקומיקאי מגיע לנשום 😅'`
- פונקציות טקסט:
  - `remainingText(n)`: `1` → `נשארה בדיחה אחת היום`; אחרת `נשארו ${n} בדיחות היום` (לפי הדוגמה ב-DESIGN §1.2).
  - `countdownText(s)`: `1` → `אפשר לנסות שוב בעוד שנייה`; אחרת `אפשר לנסות שוב בעוד ${s} שניות`.
  **הערה:** ה-PRD לא מגדיר את נוסח שורת הספירה לאחור — זה ניסוח מוצע. אציין זאת בסיום, ואפשר לשנות.

### 3.2 `src/jokesApi.ts`
- `JokeResult` בהצלחה: `{ ok: true; joke; remainingToday?: number }`.
- בכשל מתווסף שדה אופציונלי `block`:
  | קוד מהשרת | הודעה | `block` |
  |---|---|---|
  | `429 PERSONAL_QUOTA_EXCEEDED` | `PERSONAL_QUOTA_MESSAGE` | `{ kind: 'personal' }` |
  | `429 GLOBAL_QUOTA_EXCEEDED` | `GLOBAL_QUOTA_MESSAGE` | `{ kind: 'global' }` |
  | `429 RATE_LIMITED` | `RATE_LIMIT_MESSAGE` | `{ kind: 'rate', retryAfterSeconds }` (ברירת מחדל 60 אם חסר) |
  | `503 AI_UNAVAILABLE` | `PAUSED_MESSAGE` (קיים) | אין — הכפתור נשאר פעיל (FR-05) |
- פונקציה חדשה `fetchStatus(): Promise<Status | null>` — `GET /api/status`; לעולם לא זורקת; כל כשל (כולל `npm run dev` בלי `/api`) → `null`.

### 3.3 `src/screens/Home.tsx`
**State חדש:**
- `remaining: number | null` — `null` = לא ידוע (השורה מוסתרת).
- `block: null | { kind: 'personal' } | { kind: 'global' } | { kind: 'rate'; until: number }`.
- `now` שמתעדכן כל שנייה רק כשיש `block` מסוג `rate` (לספירה לאחור).

**טעינה:** ב-Mount קוראים ל-`fetchStatus()`:
- `remainingToday === 0` → `block: personal`.
- `globalAvailableEstimate === false` → `block: global`.
- `retryAfterSeconds` → `block: rate`.
- שגיאה (`null`) → לא חוסמים כלום ומסתירים את שורת היתרה; היצירה עדיין עובדת.
- גם באירוע `visibilitychange` (חזרה ללשונית / לאפליקציה) קוראים שוב ל-`fetchStatus()` — כך מי שחזר אחרי חצות יקבל כפתור פעיל בלי רענון ידני. (פשוט יותר מטיימר עד חצות.)

**אחרי בקשה:**
- הצלחה → `remaining = remainingToday`; אם הגיע ל-0 → `block: personal` מיד (הודעה + כפתור מושבת).
- `block` בתוצאה → שומרים אותו (`rate` → `until = Date.now() + retryAfterSeconds * 1000`); במכסה אישית גם `remaining = 0`.
- הבדיחה הקודמת והנושא נשארים בכל מקרה (קיים).

**תצוגה (לפי DESIGN §1.3 ו-§1.6, בלי לשנות מיקומי רכיבים):**
- סדר: מותג → כרטיס בדיחה / פתיחה → הודעת שגיאה/מצב → שדה → כפתור → **שורת יתרה** (חדש, `className="remaining"`, Caption 14px, `text-secondary`).
- **מכסה אישית / גלובלית:** ההודעה המתאימה (`role="status"`) במקום הודעת השגיאה, הכפתור `disabled`. שורת היתרה מוסתרת במצב זה (ההודעה כבר אומרת שנגמר).
- **Rate Limiting:** `RATE_LIMIT_MESSAGE` ומתחתיה `countdownText(שניות שנותרו)` (`aria-live="polite"`); הכפתור `disabled`. כשהספירה מגיעה ל-0 — `block = null`, ההודעה נעלמת והכפתור חוזר לפעול.
- שדה הנושא נשאר פעיל בזמן הגבלה (רק הכפתור מושבת, לפי ה-PRD).
- `inFlight` / `handleSubmit` מתעלמים משליחה (גם ב-Enter) כשיש `block`.
- CSS: סגנון אחד קטן ל-`.remaining` ב-`global.css`, משתמש בטוקנים הקיימים. ההודעות משתמשות ב-`.message` הקיים.

---

## 4. תיעוד

### `ARCHITECTURE.md` — ADRs חדשים
- **ADR-12: Cookie שימוש חתום** — פורמט `payload.signature` ב-HMAC-SHA256 עם `node:crypto`; שם ותכונות; שליחה בהצלחה וגם בהנפקת מזהה / יום חדש; עבודה בלי Secret נחסמת (`500`).
- **ADR-13: State של Instance וסדר הבדיקות** — `usageState` ברמת המודול עם שעון שניתן להחליף בבדיקות; הסדר: Validation → מכסה אישית → מכסה גלובלית → Rate Limiting (נרשם רק כאן) → Circuit Breaker → AI. בקשות שנחסמו במכסה לא נספרות ב-Rate Limiting. סירוב מאפס את רצף הכשלים; ביטול של הלקוח (`aborted`) לא נספר.
- **ADR-14: הגבלות בצד הלקוח** — `GET /api/status` בטעינה ובחזרה לאפליקציה; ספירה לאחור לפי `retryAfterSeconds`; אין טיימר עד חצות; נוסח הספירה לאחור הוא ניסוח שלנו.

### `CLAUDE.md` — "פקודות הרצה"
- לציין ש-`npm run dev:full` דורש גם `COOKIE_SIGNING_SECRET` ב-`.env`.

### `MILESTONES.md`
- בסיום הבנייה: 🟡 ליד כותרת Milestone 4.

---

## 5. בדיקות אוטומטיות

כל הבדיקות משתמשות בשעון מזויף (`now`) ו-State חדש לכל בדיקה. שמות הבדיקות מתארים התנהגות **באותו Instance**, לא אכיפה מובטחת.

### `server/config.test.ts` (חדש)
- ברירות מחדל כשהמשתנים ריקים / לא תקינים; ערכים מותאמים נקראים; Secret קצר/חסר → `null`.

### `server/dayKey.test.ts` (חדש)
- חורף (UTC+2): `2026-01-15T21:59:59Z` → `2026-01-15`; `22:00:00Z` → `2026-01-16`.
- קיץ (UTC+3): `2026-07-15T20:59:59Z` → `2026-07-15`; `21:00:00Z` → `2026-07-16`.
- מעבר לשעון קיץ (שישי 27.3.2026): חצות 27→28 מרץ ב-`2026-03-27T21:00Z`.
- מעבר לשעון חורף (ראשון 25.10.2026): חצות 24→25 ב-`2026-10-24T21:00Z`; חצות 25→26 ב-`2026-10-25T22:00Z`.

### `server/usageCookie.test.ts` (חדש)
- חתימה ופענוח חוזרים לאותו ערך.
- Cookie עם תוכן ששונה, חתימה שגויה, Secret אחר, Base64 שבור, JSON לא תקין, Cookie ארוך מדי → `null`.
- יום חדש → אותו מזהה, מונה 0.
- ה-`Set-Cookie` כולל `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.

### `server/rateLimiter.test.ts` (חדש)
- 5 מותרות, השישית חסומה עם `retryAfterSeconds` נכון; אחרי 60 שניות שוב מותר.
- חסימה לפי IP נשארת גם עם מזהה חדש (מחיקת Cookie).
- `peek` לא רושם.
- ניקוי: מפתחות ישנים נמחקים כשה-Map גדל.

### `server/circuitBreaker.test.ts` (חדש)
- 4 כשלים — עדיין `allowed`; החמישי פותח.
- פתוח → `rejected` עד 120 שניות; אחרי 120 שניות בדיוק בקשה **אחת** מקבלת `probe`, השנייה `rejected`.
- הצלחת בדיקה → סגור; כשל בדיקה → פתוח לעוד 120 שניות.
- הצלחה באמצע הרצף מאפסת את המונה.
- `releaseProbe` מאפשר בדיקה חדשה.

### `server/jokeHandler.test.ts`
- להתאים לחתימה החדשה (`deps`), להגדיר `COOKIE_SIGNING_SECRET` ב-`vi.stubEnv`.
- הצלחה: `200 { joke, remainingToday: 19 }` + `Set-Cookie`; בקשה שנייה עם ה-Cookie → `18`.
- `refused` / `timeout` / `failed` / `aborted` → המונה לא משתנה (בדיקה דרך בקשה נוספת / Cookie).
- מכסה אישית: Cookie עם 20 הצלחות → `429 PERSONAL_QUOTA_EXCEEDED`, `generateJoke` לא נקרא.
- מכסה גלובלית: אחרי 100 הצלחות באותו State (מזהים שונים) → `429 GLOBAL_QUOTA_EXCEEDED`.
- יום חדש לפי שעון ישראל מאפס את שני המונים.
- Rate Limiting: 6 בקשות בדקה → השישית `429 RATE_LIMITED` עם `retryAfterSeconds` ו-`Retry-After`; גם כשה-Cookie נמחק (אותו IP); בקשת Validation לא נספרת.
- Circuit Breaker: 5 כשלים רצופים → `503 AI_UNAVAILABLE` בלי קריאה ל-`generateJoke`; אחרי 120 שניות בקשה אחת מגיעה ל-AI.
- Configuration: `PERSONAL_DAILY_LIMIT=2`, `RATE_LIMIT_PER_MINUTE=2`, `CIRCUIT_FAILURE_THRESHOLD=2` משנים התנהגות בלי שינוי קוד.
- Cookie מזויף → מזהה חדש ומונה 0 (לא מתקבל).
- אין Secret → `500`.
- **פרטיות:** `console.*` לא קיבל את כתובת ה-IP באף בדיקה (Spy על `console.error`/`warn`/`log`).
- **תיעוד מגבלות Best Effort** (`describe('best-effort limits (documented, not guaranteed)')`):
  - שתי בקשות מקבילות עם Cookie של 19 הצלחות → שתיהן מצליחות (חריגה ל-21).
  - שני States נפרדים (שני Instances) → כל אחד סופר מכסה גלובלית בנפרד, ו-Circuit Breaker פתוח באחד לא חוסם את השני.
  - Replay של Cookie ישן מחזיר את המונה הישן.

### `server/statusHandler.test.ts` (חדש)
- בלי Cookie → `remainingToday: 20`, `dailyLimit: 20` + `Set-Cookie` חדש.
- עם Cookie → יתרה נכונה; יום חדש → מלאה.
- `retryAfterSeconds` מופיע רק כשחסום; `globalAvailableEstimate: false` כשהמונה הגלובלי מלא.
- `Cache-Control: no-store`; לא נספר ב-Rate Limiting.

### `src/test/jokesApi.test.ts`
- מיפוי שלושת קודי ה-`429` להודעה ול-`block`; `remainingToday` מוחזר בהצלחה.
- `fetchStatus` מחזיר `null` בכשל רשת / תשובה לא תקינה.

### `src/test/App.test.tsx`
(ה-Mock של `fetch` צריך לענות גם ל-`/api/status`.)
- שורת היתרה מוצגת בטעינה ומתעדכנת אחרי הצלחה (`נשארו 20` → `נשארו 19`); `נשארה בדיחה אחת היום` עבור 1.
- כשל ב-`/api/status` → אין שורת יתרה, והיצירה עדיין עובדת.
- הצלחה שמביאה ל-0 → הודעת מכסה אישית + כפתור מושבת.
- `429 PERSONAL_QUOTA_EXCEEDED` / `GLOBAL_QUOTA_EXCEEDED` → ההודעה, כפתור מושבת, Enter לא שולח, הבדיחה הקודמת נשארת.
- `429 RATE_LIMITED` עם `retryAfterSeconds: 3` (Fake Timers) → הודעה + ספירה `3 → 2 → 1`, כפתור מושבת; בסיום הכפתור חוזר לפעול וההודעה נעלמת.
- `503 AI_UNAVAILABLE` → `PAUSED_MESSAGE`, הכפתור **נשאר פעיל**.
- סטטוס בטעינה עם `remainingToday: 0` / `globalAvailableEstimate: false` / `retryAfterSeconds` → המצב המתאים כבר בטעינה.

### Build
- `npm run build` ו-`npm test` עוברים. חיפוש ב-`dist/` ש-`COOKIE_SIGNING_SECRET`, `OPENAI_API_KEY` ו-`sk-` לא מופיעים.

---

## 6. בדיקה ידנית שלי בסיום הבנייה

**תנאי מקדים:** המשתמש הוסיף `COOKIE_SIGNING_SECRET` ל-`.env`. אם עדיין לא — אעצור לפני הבדיקה הידנית ואבקש.

1. **`npm run dev:full`**, דפדפן ב-Viewport מובייל:
   - שורת `נשארו 20 בדיחות היום` מופיעה; אחרי יצירה → `19`; רענון → עדיין `19` (Cookie).
   - ב-DevTools: ה-Cookie `bdichomat_usage` הוא `HttpOnly` ולא נגיש ל-JavaScript של הדף.
2. **Rate Limiting:** 6 לחיצות מהירות (לאחר כל בדיחה) — השישית מציגה את ההודעה וספירה לאחור, והכפתור חוזר אחרי שהיא מסתיימת. (5 קריאות אמיתיות ל-OpenAI — עלות זניחה.)
3. **מחיקת Cookie** באמצע חסימה — עדיין חסום (לפי IP). אם `vercel dev` לא מעביר כתובת IP מקומית, אציין שזה נבדק בבדיקות האוטומטיות בלבד ויוודא שוב ב-Preview (Milestone 6).
4. **Circuit Breaker ומכסות מלאות:** אין לי אפשרות לשנות את `.env`, ולכן אלה נבדקים בבדיקות האוטומטיות. בבדיקה של המשתמש אפשר להוסיף זמנית `PERSONAL_DAILY_LIMIT=2` ל-`.env` כדי לראות את הודעת סיום המכסה בעיניים.
5. סגירת ההרצה בסיום.

---

## 7. מגבלות ידועות שיש לציין בסיום
- **אין אכיפה קשיחה.** בקשות מקבילות, Replay של Cookie ישן, מחיקת Cookies או דפדפן אחר מאפשרים חריגה מהמכסה האישית.
- **המכסה הגלובלית וה-Circuit Breaker הם לכל Instance בנפרד.** Vercel עשוי להריץ כמה Instances במקביל או להחליף Instance — כל אחד מתחיל מאפס. 100 היא יעד, לא תקרה; ההגנה על העלות היא מגבלת התקציב ב-OpenAI (Milestone 6).
- **Rate Limiting לפי IP** — משתמשים שחולקים כתובת (אותו Wi-Fi, רשת סלולרית) חולקים גם את המגבלה.
- **בדיחה שנוצרה ולא הגיעה** (סגירת האפליקציה ברגע האחרון) עשויה להיספר.
- **שורת היתרה היא הערכה** לפי ה-Cookie העדכני.
- **נוסח הספירה לאחור** (`אפשר לנסות שוב בעוד X שניות`) אינו מופיע ב-PRD — ניסוח מוצע לאישור.

---

## 8. Definition of Done — איך כל סעיף ייבדק

| סעיף | בדיקה |
|---|---|
| יתרה אישית מופיעה ומצטמצמת אחרי הצלחה; ביקור חוזר משתמש ב-Cookie חתום | `App.test.tsx`, `statusHandler.test.ts`, `jokeHandler.test.ts` + בדיקה ידנית עם רענון |
| כשלים וסירובים לא נספרים; ביטול הוא Best Effort | `jokeHandler.test.ts` (`refused`/`timeout`/`failed`/`aborted`) |
| איפוס לפי שעון ישראל, כולל מעברי שעון קיץ/חורף | `dayKey.test.ts` + בדיקת יום חדש ב-Handlers |
| הודעות מכסה, השבתת כפתור, Rate Limiting ו-Countdown באותו Instance | `App.test.tsx` (Fake Timers) + `jokeHandler.test.ts` + בדיקה ידנית |
| Rate Limiting נשאר אחרי מחיקת Cookie; IP לא בלוגים | `rateLimiter.test.ts`, `jokeHandler.test.ts` (Spy על console) |
| 5 שגיאות רצופות, 120 שניות, Probe יחיד | `circuitBreaker.test.ts`, `jokeHandler.test.ts` |
| שינוי Configuration משפיע בלי שינוי קוד | `config.test.ts` + בדיקות Handler עם `vi.stubEnv` |
| תיעוד מפורש שייתכנו חריגות ושה-Circuit Breaker אינו גלובלי | בלוק בדיקות `best-effort limits` + סעיף 7 בסיכום; אין בדיקה שטוענת לאכיפה קשיחה |
