# תוכנית — Milestone 5: השלמת עיצוב, פרטיות וניטור

**מקורות:** `MILESTONES.md` (Milestone 5 + כללי ביצוע 4–6), `PRD.md` FR-06 (פתיחה מחדש), FR-07 (ניטור), §5 אילוצים, `ARCHITECTURE.md` §2.4, §2.8, §2.9, §2.10 (ניטור), ADR-10, ADR-12, ADR-13, `DESIGN.md` §1.1–§1.7, §2.1–§2.5, ותמונות `wireframes.png`, `mockups.png`, `style-guide.png`.

**נקודת פתיחה (קוד קיים):**
- `src/styles/tokens.css` — כל צבעי ה-HEX, הגופן, גדלי הטקסט, המרווחים, הרדיוס והצל כבר מוגדרים לפי `DESIGN.md`.
- `src/styles/global.css` — מסכים, כפתורים, שדה, כרטיס בדיחה, משיכות מכחול פשוטות (צורות מעוגלות), `prefers-reduced-motion` חלקי. `body { overflow-x: hidden }` מסתיר גלילה אופקית במקום למנוע אותה.
- מסכים: `AgeGate`, `AccessDenied`, `Home`, `Offline`. המותג הוא `<h1>` רק ב-`Home`; ב-`AccessDenied`/`Offline` הוא `<p>`, וב-`AgeGate` אין `<h1>` בכלל.
- `server/jokeHandler.ts` — אין בדיקת `Origin` / `Content-Type`, אין הגבלת גודל Body (קורא `request.json()` ישירות).
- אין Security Headers או CSP (`vercel.json` מגדיר רק את ה-Function).
- לוגים: שלוש קריאות `console.*` חופשיות (`circuitBreaker.ts`, `http.ts`, `jokeService.ts`); אין Request ID, Latency או ספירת בקשות.
- פלט ה-AI כבר מוצג כטקסט (`{joke}` ב-JSX), ואין `dangerouslySetInnerHTML` בפרויקט.
- נושא ובדיחה נשמרים רק ב-State של React; אישור גיל ב-Local Storage; מזהה ב-Cookie חתום (ADR-12).

**מחוץ לטווח:** `GET /api/health` (מופיע ב-ARCHITECTURE §2.2 אך לא באף Milestone — כמו ב-Milestone 4, לא נבנה). פריסה, CI, בדיקות על Preview, מגבלת תקציב OpenAI (Milestone 6). היסטוריה, קטגוריות, לייקים, העתקה, תפריט, מסך מכסות, מסך מידע ואיור ליצן — **לא ממומשים** (`DESIGN.md`, כלל 4).

**עיקרון מנחה:** גימור ושיפור של מה שקיים, בלי מסכים, פעולות או טקסטים חדשים שלא נדרשו. אין שינוי במיקומי הרכיבים המרכזיים (`DESIGN.md` §1.6).

---

## 1. עיצוב — גימור המסכים המאושרים

### 1.1 `src/styles/tokens.css`
- להוסיף רק Tokens שחסרים לגימור, בלי צבעים חדשים מחוץ לפלטה:
  - `--primary-red-hover` — במקום ה-HEX הקשיח `#b81f08` שב-`global.css` (גוון כהה יותר של `primary-red`; זה הצבע היחיד שאינו בפלטה, והוא משמש רק ל-Hover).
  - `--focus-ring` — `var(--dark)` (טבעת Focus אחידה לכל הרכיבים).
  - `--fs-joke: 18px` — הגודל שכבר בשימוש בכרטיס הבדיחה, כדי שלא יהיה מספר קשיח.

### 1.2 רקע ודקורציה (`global.css`) — לפי ה-Mockups
- **טקסטורת נייר עדינה** על רקע הקרם: שכבת `body` עם SVG Noise קטן כ-`data:` URI (או `radial-gradient` עדין), בשקיפות נמוכה מאוד. אסור שתפגע בקריאות (`DESIGN.md` §2.4 Texture). מקור: יצירה שלנו, לא קובץ חיצוני.
- **משיכות מכחול:** להחליף את הצורות המעוגלות ב-`.brush` במשיכות מכחול "מרוחות" שנראות כמו ב-Mockup (קצוות פרועים, אלכסון). מימוש: SVG מקורי אחד (`src/assets/brush.svg`) שמשמש כ-`mask-image` או `background-image`, בצבעים `primary-yellow` / `secondary-yellow` / `secondary-red` דרך CSS. אותן מחלקות (`brush--hero`, `brush--corner`, `brush--bottom`), אותם מיקומים בערך. `aria-hidden` נשאר.
- המשיכות לא נכנסות מתחת לשדה הנושא או לכרטיס הבדיחה באופן שפוגע בקריאות (נשארות ב-`z-index: 0`, בשוליים).

### 1.3 טיפוגרפיה והיררכיית כותרות
- `<h1>` אחד בכל מסך:
  - `Home`, `AccessDenied`, `Offline` — המותג `בדיחומט` כ-`<h1 className="brand">` (היום `<p>` בשני האחרונים).
  - `AgeGate` — אין מותג במסך (כמו ב-Wireframe); הכותרת `ברוכים הבאים לבדיחומט` הופכת ל-`<h1 className="title">` (המראה לא משתנה — המחלקה קובעת את הגודל).
- `Offline` — ההודעה `אין חיבור לאינטרנט...` היא משפט ארוך; לעבור מ-H2 (24px) ל-H3 (`--fs-h3`, 20px) כדי שלא תישבר לשורות רבות ב-360px. נשאר `role="alert"`.
- טקסט ארוך: `overflow-wrap: anywhere` לכרטיס הבדיחה, להודעות ולשדה — מילה ארוכה בלי רווחים (או URL) לא תיצור גלילה אופקית.

### 1.4 רכיבים — התאמה ל-Style Guide
- **כפתור Primary:** אדום מלא, טקסט לבן Bold, רדיוס 16px, צל רך — קיים. Hover דרך `--primary-red-hover`.
- **כפתור Secondary:** רקע לבן, Border דק, טקסט כהה Medium — קיים.
- **שדה:** רקע לבן, Border אפור, רדיוס 16px, מונה תווים `0/100` בפינה התחתונה (בצד שמאל ב-RTL, כמו ב-Style Guide) — קיים. לוודא שהטקסט לא נכנס מתחת למונה (padding תחתון קיים).
- **כרטיס בדיחה:** ב-Mockup הכרטיס בגוון קרם בהיר עם צל רך ולא לבן בוהק — להחליף ל-`var(--background)` עם Border דק מאוד או צל בלבד, כך שיובחן מהרקע המרוקם. הטקסט ממורכז כמו ב-Mockup? **לא** — `DESIGN.md` §2.5 קובע שתוכן קריא וארוך מיושר לימין; נשאר `text-align: right`.
- **תג 18+:** מסגרת אדומה עבה, רקע לבן, טקסט כהה — קיים. להגביה מעט את אזור ה-Hero (כ-240px) כדי להתקרב ל-Mockup.
- **סמל חסימה:** קו מתאר אדום — קיים.

### 1.5 מצבים — אותה מערכת עיצוב (`DESIGN.md` §1.6)
- **Loading:** שורת `ממציאים לכם בדיחה...` עם האייקון המתנדנד; כבוי תחת `prefers-reduced-motion`.
- **Disabled:** כפתור — Opacity 0.55 + `cursor: not-allowed` (קיים; אינו נשען על צבע בלבד). שדה — רקע `surface` וטקסט אפור (קיים).
- **הודעות שגיאה / מכסה / Rate Limiting:** כולן במחלקה `.message` (אדום, Medium, מיושר לימין). להוסיף מסגרת עדינה: רקע `accent-pink` בהיר, רדיוס 16px, ריווח 8/16px — כדי שההודעה תיראה כחלק מאותה משפחת רכיבים ולא כטקסט צף. הודעת הקלט (רווחים בלבד) באותו סגנון, צמודה לשדה. ניגודיות אדום על ורוד נבדקת (סעיף 1.6).
- **Offline:** אותו רקע, טיפוגרפיה וכפתור. **בלי** אייקון חדש — `DESIGN.md` §1.5 אוסר להוסיף תמונות למסך זה.

### 1.6 נגישות
- **Focus גלוי לכל רכיב פוקוס:** `:focus-visible` עם `outline: 3px solid var(--focus-ring)` וגם לשדה (היום `outline: none` + טבעת צל אדומה — להשאיר את הטבעת ולוודא שהיא נראית גם במצב High Contrast: להוסיף `outline: 2px solid transparent` כדי ש-Windows High Contrast יציג קו).
- **ניגודיות:** לבדוק (חישוב יחס ניגודיות בבדיקה אוטומטית קטנה, סעיף 5) את הצמדים בשימוש: טקסט כהה על קרם, `text-secondary` על קרם, אדום על קרם, אדום על ורוד (הודעות), לבן על אדום (כפתור). יעד: 4.5:1 לטקסט רגיל. צמד שנכשל — מכהים את הרקע/טקסט בתוך הפלטה ומדווחים.
- **`prefers-reduced-motion`:** לכבות גם את `transform` של `:active` וכל אנימציה חדשה של משיכות/טקסטורה (אין כאלה מתוכננות).
- `<meta name="color-scheme" content="light">` ב-`index.html` — כדי שדפדפנים במצב כהה לא יהפכו צבעים אוטומטית.
- כפתורים כבר עם טקסט גלוי (שם נגיש). `aria-live` קיים לכרטיס ולספירה לאחור.

### 1.7 Mobile ו-RTL
- למחוק את `overflow-x: hidden` מ-`body` (הוא מסתיר בעיות) ולהשאיר `overflow: hidden` רק על `.screen` עבור המשיכות. אם משהו גולש — מתקנים את הרכיב עצמו.
- רוחבים לבדיקה: 320, 360, 375, 390, 430 (ו-768 לוודא שהעמודה ממורכזת ברוחב 480px).
- מונה התווים ב-`dir="ltr"` (`12/100`) — קיים. ספרות בתוך הודעות בעברית (`נשארו 20 בדיחות היום`) מוצגות נכון — לוודא חזותית.
- `env(safe-area-inset-*)` — קיים לתחתית; להוסיף גם לראש המסך (מצב PWA מותקן עם Notch).

---

## 2. אבטחה

### 2.1 `server/requestGuard.ts` (חדש) — בדיקות לפני כל לוגיקה ב-`POST /api/jokes`
פונקציה `guardJsonPost(request): { ok: true, body: unknown } | Response`, נקראת ב-`jokeHandler` **לפני** פענוח ה-Cookie, המכסות וה-Rate Limiting:

1. **Origin (הגנת CSRF, §2.9):** הכותרת `Origin` חייבת להיות זהה ל-Origin של הבקשה עצמה (`new URL(request.url).origin`). חסרה או שונה → `403 FORBIDDEN_ORIGIN`. דפדפנים תמיד שולחים `Origin` ב-`POST`, ולכן משתמשים רגילים לא נפגעים; כלים כמו `curl` בלי `Origin` נחסמים — זה מכוון.
   - אופציונלי: משתנה סביבה `ALLOWED_ORIGINS` (רשימה מופרדת בפסיקים) לדומיינים נוספים. **לא** מוסיפים אותו כרגע — רק אם יתברר ב-Milestone 6 שה-`request.url` ב-Vercel אינו תואם לדומיין. (נקודה לבדיקה ב-Preview, נרשמת ב-ADR.)
2. **Content-Type:** חייב להתחיל ב-`application/json` → אחרת `415 UNSUPPORTED_MEDIA_TYPE`.
3. **גודל Body:** מקסימום 4 KB (`MAX_BODY_BYTES = 4096`). נושא של 100 תווים + בדיחה קודמת עד 500 תווים בעברית ובאימוג'י הם הרבה פחות. בודקים `Content-Length` אם קיים, ובכל מקרה קוראים את הגוף כטקסט ומודדים בבתים (`new TextEncoder().encode(text).length`) — כי `Content-Length` יכול לחסור. חריגה → `413 PAYLOAD_TOO_LARGE` (כבר בחוזה §2.4).
4. JSON לא תקין → `400 INVALID_TOPIC` (כמו היום).

כל הבדיקות האלה **לא** צורכות Rate Limiting ולא קוראות ל-OpenAI (§2.5 סעיף 7).

### 2.2 `server/errors.ts`
- להוסיף ל-`ErrorCode`: `PAYLOAD_TOO_LARGE`, `FORBIDDEN_ORIGIN`, `UNSUPPORTED_MEDIA_TYPE`. ההודעה בכולם: `GENERAL_FAILURE_MESSAGE` (ה-PRD לא מגדיר נוסח נפרד, והמשתמש הרגיל לא אמור להגיע אליהן).
- בלקוח (`src/jokesApi.ts`) אין שינוי: קוד לא מוכר כבר ממופה להודעת הכשל הכללית (ADR-9).

### 2.3 Cookie
- אימות קיים (ADR-12). להוסיף בדיקות ברמת ה-Handler (סעיף 5): Cookie מזויף עם `successCount: 0` אחרי שהמכסה מוצתה, או עם חתימה שגויה, מטופל כאילו אינו קיים (מזהה חדש) — ולא מקבל יתרה שהוא "המציא". זה מכוון; Replay של Cookie ישן עדיין אפשרי (Best Effort, ADR-12).

### 2.4 Security Headers — `vercel.json`
להוסיף `headers` לכל הנתיבים (`"source": "/(.*)"`):

| Header | ערך |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (לדפדפנים ישנים; `frame-ancestors` הוא העיקר) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |

- HSTS: Vercel מוסיף אותו בעצמו לדומיינים שלו — נבדק ב-Milestone 6, לא מגדירים כאן.
- **סיכון ל-CSP:** Build של Vite ו-`vite-plugin-pwa` (`injectRegister: 'script'`) מייצרים קבצי JS חיצוניים בלבד, בלי Inline Scripts; React לא משתמש ב-`style=""` בקוד שלנו. לאמת אחרי ה-Build: לחפש `<script>` ו-`style=` Inline ב-`dist/index.html`, ולבדוק בדפדפן (`vercel dev`) שאין שגיאות CSP בקונסול. אם `data:` של הטקסטורה דורש — כבר מכוסה ב-`img-src`.
- **בדיקה מקומית:** `vercel dev` מחיל את ה-`headers` של `vercel.json`. `npm run preview` לא — להוסיף את אותם Headers ל-`preview.headers` ב-`vite.config.ts` מתוך קבוע משותף, כדי שגם בדיקת ה-PWA תרוץ עם CSP. (`server.headers` של `npm run dev` — **לא**, כי Vite dev מזריק Inline Scripts ל-HMR.)

### 2.5 פלט AI כטקסט
- כבר מוצג כ-`{joke}`. להוסיף בדיקה (סעיף 5) שבדיחה עם `<img src=x onerror=...>` ו-`<b>` מוצגת כטקסט מילולי ואין אלמנט `img`/`b` ב-DOM.
- בדיקה שאין `dangerouslySetInnerHTML` / `innerHTML` בקוד `src/` (חיפוש בטקסט של קובצי המקור בבדיקה).

---

## 3. ניטור ולוגים מובנים

### 3.1 `server/log.ts` (חדש)
- `logEvent(event: LogEvent)` כותב שורת JSON אחת ל-`console.log` / `console.warn` / `console.error` לפי `level`.
- `LogEvent` הוא **טיפוס סגור** (Union) — רק השדות האלה מותרים, כך שאי אפשר בטעות להעביר נושא, בדיחה, Cookie או IP:

| event | שדות |
|---|---|
| `joke_request` | `requestId`, `status` (HTTP), `code` (קוד שגיאה / `OK`), `latencyMs`, `aiLatencyMs?`, `circuit` (`closed`/`open`/`half-open`) |
| `circuit_opened` | `failures`, `openMs` |
| `circuit_closed` | — (אחרי Probe מוצלח) |
| `ai_error` | `requestId`, `errorName` (שם מחלקת השגיאה בלבד) |
| `config_error` | `missing` (שם המשתנה, לא ערך) |

- כל שורה כוללת `ts` (ISO) ו-`level`. `requestId`: הכותרת `x-vercel-id` אם קיימת, אחרת `crypto.randomUUID()`.
- **אין** בשורות: נושא, בדיחה, בדיחה קודמת, Cookie, מזהה אנונימי, IP, User-Agent או Headers.

### 3.2 שילוב
- `jokeHandler.ts` — מודד זמן מתחילת הבקשה; בכל יציאה (הצלחה, כל שגיאה, כולל דחיות מ-`requestGuard`) כותב `joke_request` אחד. מימוש: עטיפה אחת סביב ה-Handler הקיים שקוראת את ה-`status` וה-`code` מהתשובה, כדי לא לפזר לוגים בכל `return`.
- `circuitBreaker.ts` — `console.warn` הקיים → `circuit_opened`; מעבר ל-`closed` אחרי Probe → `circuit_closed`. צריך גם לחשוף `state()` (`closed`/`open`/`half-open`) לשדה `circuit`.
- `jokeService.ts` — `console.error` הקיים → `ai_error` (רק `errorName`).
- `http.ts` — `console.error` הקיים → `config_error`.
- `statusHandler.ts` — **לא** נכתב לוג לכל `GET /api/status` (נקרא בכל חזרה לאפליקציה; רעש בלי ערך תפעולי). שגיאת Config נרשמת דרך `http.ts`.

### 3.3 "נתוני תפעול בסיסיים" (FR-07)
אין Dashboard או ממשק ניהול (`ARCHITECTURE.md` §2.10). הנתונים נגזרים מסינון הלוגים ב-Vercel Runtime Logs:
- כמות בקשות = מספר שורות `joke_request`; שגיאות API = `code` של `AI_TIMEOUT` / `INTERNAL_ERROR` / `ai_error`; Latency = `latencyMs`; הפעלת Circuit Breaker = `circuit_opened`.
- לתעד את שמות האירועים והשדות ב-ADR, כדי שאפשר יהיה לחפש אותם ב-Milestone 6.

---

## 4. פתיחה מחדש (FR-06)
אין שינוי קוד צפוי — רק אימות ובדיקות:
- נושא ובדיחה ב-State של `Home` בלבד → מתאפסים בפתיחה מחדש.
- `ageConfirmed` ב-Local Storage → נשמר.
- Cookie `bdichomat_usage` עם `Max-Age` של שנה → נשמר; היתרה מוצגת לפי ה-Cookie.
- לוודא שאין `sessionStorage` / Local Storage של נושא או בדיחה (חיפוש בקוד).

---

## 5. בדיקות אוטומטיות

### `server/requestGuard.test.ts` (חדש)
- `Origin` תואם עובר; `Origin` חסר / אחר / `null` → `403`.
- `Content-Type` חסר / `text/plain` → `415`; `application/json; charset=utf-8` עובר.
- Body של 4096 בתים עובר; 4097 → `413` (גם בלי `Content-Length`, וגם עם `Content-Length` גדול).

### `server/jokeHandler.test.ts`
- עדכון כל הבקשות בבדיקות הקיימות לכלול `Origin` ו-`Content-Type` תקינים (Helper אחד).
- `403` / `413` / `415` לא קוראים ל-`generateJoke` ולא צורכים Rate Limiting (אחרי 10 דחיות, בקשה תקינה עדיין עוברת).
- Cookie מזויף (חתימה שגויה) אחרי מכסה מוצתה → מזהה חדש, אבל ה-Rate Limiting לפי IP עדיין חל.
- **לוגים:** `vi.spyOn(console, ...)`; בקשה עם נושא ייחודי (`'נושא-סודי-123'`), בדיחה ייחודית, Cookie ו-`x-forwarded-for` — אף שורת לוג לא מכילה אף אחד מהם. כל תשובה מייצרת בדיוק שורת `joke_request` אחת עם `status`, `code`, `latencyMs`.

### `server/circuitBreaker.test.ts`
- `circuit_opened` נכתב פעם אחת כשנפתח; `circuit_closed` אחרי Probe מוצלח; `state()` מחזיר את המצב הנכון.

### `server/log.test.ts` (חדש)
- פלט הוא JSON תקין בשורה אחת עם `ts`, `level`, `event`.

### `src/test/App.test.tsx`
- בדיחה עם HTML מוצגת כטקסט מילולי (סעיף 2.5).
- **פתיחה מחדש:** אחרי יצירת בדיחה, `unmount` + `render` חדש → מסך ראשי (לא הצהרת גיל), שדה ריק, אין כרטיס בדיחה, הכותרת `על מה צוחקים היום? 😂` מוצגת.
- `<h1>` אחד בדיוק בכל אחד מ-4 המסכים.
- אין `dangerouslySetInnerHTML` / `innerHTML` בקבצים תחת `src/` (קריאת קבצים עם `import.meta.glob(..., { query: '?raw' })`).

### `src/test/contrast.test.ts` (חדש)
- חישוב יחס ניגודיות WCAG לצמדי הצבעים בסעיף 1.6, מתוך הערכים ב-`tokens.css`; כל צמד טקסט ≥ 4.5:1.

### Build
- `npm run build` ו-`npm test` עוברים. בדיקה ש-`dist/index.html` אינו מכיל `<script>` Inline (לטובת ה-CSP).

---

## 6. תיעוד

### `ARCHITECTURE.md` — ADRs חדשים
- **ADR-16: בדיקות בקשה לפני הלוגיקה** — Origin זהה ל-Origin הבקשה, `Content-Type`, 4 KB, קודים `403`/`415`/`413`; לבדוק ב-Preview ש-`request.url` תואם לדומיין.
- **ADR-17: Security Headers ו-CSP** — הערכים, ולמה גם ב-`preview` אבל לא ב-`dev`.
- **ADR-18: לוגים מובנים** — טיפוס סגור, שמות האירועים והשדות, למה אין לוג ל-`/api/status`, איך מפיקים מהם את נתוני FR-07.

### `MILESTONES.md`
- סימון 🟡 ליד Milestone 5 בסיום הבנייה.

### `CLAUDE.md` — "פקודות הרצה"
- ללא שינוי צפוי. אם בקשות מ-`curl` ייחסמו בגלל Origin — לא רלוונטי לפקודות.

---

## 7. בדיקה ידנית שלי בסיום הבנייה
1. `npm run dev:full` → דפדפן ב-Viewport מובייל (360/375/390, ו-320): ארבעת המסכים (Offline דרך מצב Offline של הדפדפן). אין גלילה אופקית (`document.documentElement.scrollWidth <= clientWidth`), אין טקסט חתוך. צילומי מסך להשוואה מול ה-Mockups.
2. כל המצבים במסך הראשי: Loading, שגיאה, רווחים בלבד, Rate Limiting (מדומה ב-`RATE_LIMIT_PER_MINUTE=1` — בהרצה המקומית רק המראה, ADR-15), מכסה אישית (`PERSONAL_DAILY_LIMIT=1`).
3. מעבר במקלדת (Tab) בכל מסך — Focus גלוי על כל כפתור ושדה.
4. `prefers-reduced-motion: reduce` (אמולציה בדפדפן) — אין אנימציות.
5. קונסול: אין שגיאות CSP. כותרות התשובה כוללות את ה-Headers מסעיף 2.4.
6. בקשה ידנית ל-`/api/jokes` עם `Origin` זר / `text/plain` / Body גדול → `403` / `415` / `413`.
7. לוגים בטרמינל של `vercel dev`: שורת JSON לכל בקשה, בלי נושא או בדיחה.
8. פתיחה מחדש (סגירת הלשונית ופתיחה) → מסך ראשי ריק, אותה יתרה.
9. `npm run build` + `npm run preview`: ה-PWA עובד עם ה-CSP (Service Worker נרשם, מסך Offline).
10. סגירת ההרצה בסיום.

---

## 8. מגבלות ידועות שיש לציין בסיום
- בדיקת `Origin` מגינה מ-CSRF בדפדפנים בלבד; אינה מונעת קריאה ישירה מסקריפט שמזייף כותרות. Rate Limiting ומכסות נשארים Best Effort.
- הלוגים נשמרים ב-Vercel לפי מדיניות התוכנית; זמינות וחיפוש בהם נבדקים ב-Milestone 6. Access Logs של Vercel עצמה (שעשויים לכלול IP) אינם בשליטתנו (§2.9).
- CSP ו-Security Headers נבדקים מקומית; ההתנהגות בדומיין האמיתי נבדקת ב-Preview (Milestone 6).
- הטקסטורה ומשיכות המכחול הן יצירה מקורית בהשראת ה-Mockups, לא העתקה מדויקת שלהם.

---

## 9. Definition of Done — איך כל סעיף ייבדק

| סעיף | איך נבדק |
|---|---|
| ארבעת המסכים נבדקו ב-Viewport מובייל; אין גלילה אופקית או חיתוך טקסט | בדיקה ידנית 1, ברוחבים 320–430, עם בדיקת `scrollWidth` וצילומי מסך |
| גופנים, HEX, כפתורים, שדות, כרטיסים, מרווחים והיררכיה תואמים ל-`DESIGN.md` | השוואת `tokens.css` לטבלה §2.1–§2.4; צילומי מסך מול ה-Mockups וה-Style Guide |
| עברית, RTL, Focus גלוי, ניגודיות, `prefers-reduced-motion` | `contrast.test.ts`; בדיקת `<h1>`; בדיקה ידנית 3–4 |
| דחיית קלט חריג / Origin לא מאושר / Cookie מזויף; פלט AI לא מוזרק כ-HTML | `requestGuard.test.ts`, `jokeHandler.test.ts`, בדיקת HTML ב-`App.test.tsx`; בדיקה ידנית 6 |
| לוגים תפעוליים בלי נושאים, בדיחות, Cookies או מזהים | בדיקת הלוגים ב-`jokeHandler.test.ts`; בדיקה ידנית 7 |
| פתיחה מחדש מאפסת נושא ובדיחה, לא גיל ולא Cookie | בדיקת `unmount`/`render` ב-`App.test.tsx`; בדיקה ידנית 8 |
| אין היסטוריה, קטגוריות, לייקים, העתקה, תפריט או מסכי מידע | סקירת הקוד והמסכים; אין רכיבים או טקסטים כאלה |
