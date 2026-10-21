# תוכנית — Milestone 3: תקלות, ביטול בקשות ושימוש ללא חיבור

**מקורות:** `MILESTONES.md` (Milestone 3), `PRD.md` FR-05 / FR-06 וטבלת Edge Cases, `ARCHITECTURE.md` §1.2 סעיף 7, §2.4, §2.6, §2.8, §2.10, `DESIGN.md` §1.5, §1.6, §2.6.
**נקודת פתיחה (קוד קיים):** `server/jokeHandler.ts` מחזיר `200` / `400 INVALID_TOPIC` / `422 UNSUPPORTED_TOPIC` / `500 INTERNAL_ERROR`; `server/jokeService.ts` יוצר לקוח OpenAI בלי Timeout ובלי ביטול; `src/jokesApi.ts` מציג את ה-`message` מהשרת או הודעה כללית (ADR-7, זמני); אין PWA, אין Manifest, וה-favicon הוא סמיילי שאינו לפי `DESIGN.md` §2.6.

**מחוץ לטווח (Milestone 4 ואילך):** `GET /api/status`, Cookie, מכסות, Rate Limiting, Circuit Breaker (השרת עדיין לא מחזיר `503`; הלקוח רק יודע למפות אותו), בדיקת Origin, Logs מובנים. אין להוסיף אותם כאן.

---

## 1. Backend — Timeout וביטול

### 1.1 `server/errors.ts`
- להוסיף `TIMEOUT_MESSAGE = 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'`.
- להרחיב את `ErrorCode` ב-`'AI_TIMEOUT'` בלבד (`AI_UNAVAILABLE` יתווסף בשרת ב-Milestone 4).

### 1.2 `server/jokeService.ts`
- `JokeOutcome` מקבל סוג נוסף: `{ kind: 'timeout' }`.
- `generateJoke(request, client?, options?)` — `options: { signal?: AbortSignal }`.
- זמן ההמתנה נקרא מ-`AI_TIMEOUT_MS` (ברירת מחדל `28000`; ערך ריק/לא מספרי/לא חיובי → ברירת המחדל). פונקציה קטנה `readTimeoutMs()`.
- יצירת הלקוח: `new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 0 })`.
  **חשוב:** ברירת המחדל של ה-SDK היא 2 ניסיונות חוזרים אוטומטיים — זה סותר את "אין Retry אוטומטי" (§2.6) ויכול להאריך את ההמתנה הרבה מעבר ל-28 שניות. `maxRetries: 0` חובה.
- הקריאה: `openai.responses.create(params, { signal: options.signal, timeout: timeoutMs, maxRetries: 0 })` — העברת האפשרויות גם ברמת הבקשה, כדי שגם לקוח מזויף בבדיקות יקבל אותן ושאפשר יהיה לבדוק זאת.
- טיפול בשגיאות ב-`catch`:
  - `OpenAI.APIConnectionTimeoutError` → `{ kind: 'timeout' }`.
  - `OpenAI.APIUserAbortError` (הלקוח התנתק) → `{ kind: 'failed' }`, בלי לוג שגיאה (זה לא כשל שירות).
  - כל השאר → `{ kind: 'failed' }` עם הלוג הקיים (שם השגיאה בלבד).
- שאר הטיפול בתשובה (incomplete / refusal / JSON לא תקין / בדיחה ריקה) כבר קיים — נשאר כמו שהוא.

### 1.3 `server/jokeHandler.ts`
- מעביר `{ signal: request.signal }` ל-`generateJoke`.
- מיפוי: `timeout` → `504 { code: 'AI_TIMEOUT', message: TIMEOUT_MESSAGE }`.
- אם `request.signal.aborted` אחרי הקריאה — מחזירים את אותה תשובת `500` (אין למי לשלוח אותה; לא צריך מסלול מיוחד).

### 1.4 `vercel.json`
```json
"functions": {
  "api/jokes.ts": { "maxDuration": 40, "supportsCancellation": true }
}
```
- `maxDuration: 40` לפי §1.2 סעיף 7 / §2.10.
- `supportsCancellation: true` — לפי תיעוד Vercel (Functions API Reference → Cancel requests), רק כך `request.signal` נורה כשהלקוח מתנתק. זה Best Effort: קריאת OpenAI שכבר התחילה עשויה עדיין להיות מחויבת.
- לבדוק ש-`vercel dev` מקבל את ההגדרה בלי שגיאה.

### 1.5 `.env.example`
- להוסיף `AI_TIMEOUT_MS=` (ללא ערך). להודיע למשתמש שזה אופציונלי — כשהשדה ריק, ברירת המחדל היא 28 שניות.

---

## 2. Frontend — מיפוי שגיאות, Timeout בלקוח וביטול

### 2.1 `src/messages.ts` (חדש)
ריכוז נוסחי FR-05 בצד הלקוח (העתק מילולי מה-PRD):
- `GENERAL_FAILURE_MESSAGE`, `TIMEOUT_MESSAGE`, `PAUSED_MESSAGE` (`הקומיקאי לוקח הפסקה קצרה ☕ אפשר לנסות שוב בעוד כמה דקות.`), `CONNECTION_DROPPED_MESSAGE` (`החיבור נקטע באמצע הבדיחה 📡 אפשר לנסות שוב.`), `REFUSAL_MESSAGE`, `OFFLINE_MESSAGE` (`אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.`).

### 2.2 `src/jokesApi.ts`
- חתימה: `requestJoke(topic, previousJoke, signal?: AbortSignal)`.
- תוצאה: `{ ok: true; joke } | { ok: false; message } | { ok: false; aborted: true }` — ביטול (רענון/סגירה/עזיבת המסך) לא מציג הודעה.
- Timeout בלקוח: `CLIENT_TIMEOUT_MS = 35000`. `AbortController` פנימי + `setTimeout` (ולא `AbortSignal.timeout`, כדי ש-Fake Timers יעבדו בבדיקות); ה-signal החיצוני מחובר אליו. אם ה-Timeout הוא שגרם לביטול → `TIMEOUT_MESSAGE`. לנקות את ה-Timer בכל סיום.
- מיפוי לפי `code` מהשרת (§2.8), לא לפי ה-`message`:
  | מצב | הודעה |
  |---|---|
  | `200` עם `joke` לא ריק | הצלחה |
  | `504 AI_TIMEOUT` | `TIMEOUT_MESSAGE` |
  | `503 AI_UNAVAILABLE` | `PAUSED_MESSAGE` |
  | `422 UNSUPPORTED_TOPIC` | `REFUSAL_MESSAGE` |
  | `400 INVALID_TOPIC` | ה-`message` מהשרת אם קיים (למשל הודעת הרווחים), אחרת כללית |
  | כל קוד אחר / תשובה לא JSON / `200` בלי בדיחה | `GENERAL_FAILURE_MESSAGE` |
  | `fetch` נכשל (שגיאת רשת) | `CONNECTION_DROPPED_MESSAGE` |
  | ביטול חיצוני | `aborted` — ללא הודעה |
- הפונקציה עדיין לעולם לא זורקת.

### 2.3 `src/screens/Home.tsx`
- `useRef<AbortController | null>` לבקשה הפעילה; כל שליחה יוצרת Controller חדש.
- `useEffect` אחד: מאזין ל-`pagehide` (רענון, סגירה, ניווט החוצה — אמין יותר מ-`beforeunload` במובייל) שקורא `abort()`, וב-Cleanup (Unmount) גם קורא `abort()` ומסיר את המאזין.
- תוצאה `aborted` → לא משנים הודעה/בדיחה; רק משחררים את הנעילה.
- בכל כשל: הבדיחה והנושא נשארים, הכפתור פעיל לניסיון ידני (כבר קיים — לא לשבור). אין ניסיון חוזר אוטומטי.
- ייבוא `GENERAL_FAILURE_MESSAGE` מ-`messages.ts` במקום מ-`jokesApi.ts`.

### 2.4 מסך Offline — `src/screens/Offline.tsx` (חדש) + `src/useOnlineStatus.ts` (חדש)
- `useOnlineStatus()`: מצב התחלתי `navigator.onLine`, מתעדכן מאירועי `online` / `offline`; מחזיר גם `recheck()` שקורא שוב את `navigator.onLine`.
- `Offline.tsx` לפי `DESIGN.md` §1.5: אותו `.screen` ואותו רקע, כותרת מותג `בדיחומט`, ההודעה `OFFLINE_MESSAGE`, וכפתור Primary `נסו שוב` שקורא ל-`recheck()`. בלי תמונות, אייקונים חדשים או פעולות נוספות.
- `App.tsx`: כשאין רשת — מציגים את `Offline` **ומסתירים** (`hidden`) את המסך הנוכחי במקום להסיר אותו, כך ש-`Home` נשאר טעון והנושא והבדיחה נשמרים. חזרת רשת (אירוע `online` או `נסו שוב`) מחזירה אותו כמו שהוא. חל על כל מסך (גיל, חסימה, ראשי).
- **ההבחנה בין המצבים:** מסך Offline נקבע רק לפי `navigator.onLine` ואירועי הדפדפן. כשל `fetch` בזמן שהדפדפן מדווח על חיבור → הודעת "החיבור נקטע" בתוך המסך הראשי (סעיף 2.2), לא מסך Offline.
- תיעוד ADR (סעיף 5).

---

## 3. PWA — Manifest ו-Service Worker

### 3.1 תלות
- `vite-plugin-pwa` (גרסה 2.x; ה-peer תומך ב-Vite 8 — נבדק ב-`npm view`) כ-devDependency.

### 3.2 `vite.config.ts`
```ts
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'script',          // registration script added to index.html; no app code changes
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: 'בדיחומט', short_name: 'בדיחומט', lang: 'he', dir: 'rtl',
    display: 'standalone', start_url: '/', scope: '/',
    theme_color: '#CF240A', background_color: '#FAF9F6',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [],               // no runtime caching at all: never cache /api/* or jokes
  },
})
```
- **אין** `devOptions.enabled` — ה-Service Worker פעיל רק ב-Build. לכן בדיקת ה-Offline האמיתית נעשית עם `npm run build` + `npm run preview`.
- לוודא ש-Vitest עדיין רץ (התוסף לא אמור להפריע; אם כן — `disable: !!process.env.VITEST`).
- אין טיפול ב-`beforeinstallprompt` ואין כפתור התקנה (FR-06).
- לוודא שהגופן Heebo (woff2 מ-`@fontsource`) נכנס ל-precache, כדי שמסך ה-Offline יוצג בגופן הנכון.

### 3.3 `index.html`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` (התקנה ב-iOS). ה-`theme-color` הקיים נשאר.

### 3.4 `.gitignore`
- לבדוק אם ה-Build יוצר קבצים מחוץ ל-`dist/` (לא צפוי); אם כן — להוסיף שורה.

---

## 4. אייקון האפליקציה (`DESIGN.md` §2.6)

### 4.1 גישה
האות `ב` צריכה להיות Heebo 700, אבל ספריית ההמרה לתמונה לא מכירה את הגופן. לכן סקריפט חד-פעמי ממיר את האות לצורה גרפית (Path) מתוך קובץ הגופן שכבר מותקן, ואז מייצר את קובצי ה-PNG.

### 4.2 `scripts/generate-icons.mjs` (חדש) + devDependencies `opentype.js`, `sharp`
- קורא `node_modules/@fontsource/heebo/files/heebo-hebrew-700-normal.woff` (opentype.js תומך ב-woff, לא ב-woff2) ומוציא את ה-Path של `ב`.
- בונה שני SVG:
  - **רגיל:** ריבוע `#CF240A` עם פינות מעוגלות (רדיוס ≈ 18% מהצלע), האות בלבן ממורכזת, בגובה ≈ 60% מהצלע.
  - **maskable:** רקע `#CF240A` מלא עד הקצוות (בלי פינות — מערכת ההפעלה חותכת), האות קטנה יותר כך שכולה בתוך האזור הבטוח (עיגול בקוטר 80% מהמרכז).
- פלט ל-`public/`: `favicon.svg` (מחליף את הסמיילי), `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png`, `apple-touch-icon.png` (180×180, ריבוע מלא בלי שקיפות).
- סקריפט npm: `"icons": "node scripts/generate-icons.mjs"`. הקבצים שנוצרו נשמרים בפרויקט; הסקריפט נשאר לשחזור.

### 4.3 אישור המשתמש
בסיום הבנייה מציגים למשתמש את האייקון הרגיל ואת גרסת ה-maskable (קבצי התמונה) ומבקשים אישור. שינוי שיתבקש — תיקון בתוך Milestone 3.

---

## 5. תיעוד

### `ARCHITECTURE.md` — ADRs חדשים
- **ADR-8: Timeout וביטול בשרת** — `maxRetries: 0` ו-`timeout` ב-SDK; `request.signal` מועבר ל-OpenAI; `supportsCancellation` ו-`maxDuration: 40` ב-`vercel.json`; ביטול הוא Best Effort.
- **ADR-9: מיפוי שגיאות בלקוח לפי קוד** — מחליף את ADR-7: הנוסחים יושבים ב-`src/messages.ts`, המיפוי לפי `code`; Timeout של 35 שניות בלקוח עם `setTimeout`; ביטול ב-`pagehide`/Unmount ללא הודעה.
- **ADR-10: מסך Offline כשכבה מעל המסך הנוכחי** — המסך הקודם מוסתר ולא מוסר, כדי לשמר נושא ובדיחה; ההחלטה נשענת רק על `navigator.onLine`.
- **ADR-11: יצירת אייקונים בסקריפט** — opentype.js + sharp, הגופן מתוך `@fontsource/heebo`, הקבצים נשמרים ב-`public/`.

### `CLAUDE.md` — "פקודות הרצה"
- להוסיף: **בדיקת PWA/Offline:** `npm run build` ואז `npm run preview` (http://localhost:4173) — ה-Service Worker פעיל רק כאן. (בהרצה הזו אין `/api`.)
- להוסיף ל-`.claude/launch.json` תצורת `preview` בפורט 4173.

### `MILESTONES.md`
- בסיום: 🟡 ליד כותרת Milestone 3.

---

## 6. בדיקות אוטומטיות

### `server/jokeService.test.ts`
- הלקוח נקרא עם `maxRetries: 0`, `timeout: 28000` ו-`signal` שהועבר.
- `AI_TIMEOUT_MS=5000` משנה את ה-Timeout; ערך ריק/לא תקין → 28000.
- `APIConnectionTimeoutError` → `timeout`; `APIUserAbortError` → `failed` בלי לוג.

### `server/jokeHandler.test.ts`
- `timeout` → `504` עם `AI_TIMEOUT` והנוסח מ-FR-05, `Cache-Control: no-store`.
- `request.signal` מועבר ל-`generateJoke`.
- תשובה ריקה / לא תקינה ממשיכה להחזיר `500` (קיים).

### `src/test/jokesApi.test.ts` (חדש)
- כל שורה בטבלת המיפוי בסעיף 2.2.
- Fake Timers: שרת שלא עונה → אחרי 35 שניות `TIMEOUT_MESSAGE`, ולא לפני.
- `fetch` נדחה ב-`TypeError` → `CONNECTION_DROPPED_MESSAGE`.
- ביטול חיצוני → `aborted`, ללא הודעה.

### `src/test/App.test.tsx`
- כשל (500/504/422/רשת): ההודעה הנכונה מוצגת, הבדיחה והנושא נשארים, הכפתור פעיל, ולא נשלחה בקשה נוספת אוטומטית (`fetch` נקרא פעם אחת).
- ניסיון ידני אחרי כשל שולח בקשה חדשה ומחליף את הבדיחה.
- `pagehide` במהלך בקשה מבטל את ה-signal שנשלח ל-`fetch`.
- אירוע `offline` (עם `navigator.onLine = false`) מציג את מסך ה-Offline; `online` מחזיר למסך הראשי עם אותו נושא ואותה בדיחה.
- `נסו שוב` כשאין רשת — נשאר ב-Offline; כשיש — חוזר.
- כשל `fetch` כש-`navigator.onLine = true` — הודעת "החיבור נקטע" במסך הראשי, לא מסך Offline.
- מסך Offline מופיע גם מעל הצהרת הגיל.
- להתאים את הבדיקה הקיימת "shows the general failure message when the network fails" — עכשיו הנוסח הוא "החיבור נקטע".

### Build
- `npm run build` עובר; ב-`dist/` יש `manifest.webmanifest`, `sw.js`, האייקונים; ב-manifest שלושת האייקונים; ב-`sw.js` אין `/api` ב-precache וב-runtime caching.
- חיפוש ב-`dist/` שאין `OPENAI_API_KEY` / `sk-` (כמו ב-Milestone 2).

---

## 7. בדיקה ידנית שלי בסיום הבנייה

1. **`npm run dev:full`** (עם המפתח שב-`.env`): יצירת בדיחה אמיתית עדיין עובדת; נושא שמעורר סירוב מציג את הודעת הסירוב.
2. **Timeout:** אי אפשר לשנות את `.env`, לכן הבדיקה העיקרית אוטומטית. בנוסף, אם אפשר — הרצת `vercel dev` עם `AI_TIMEOUT_MS=1000` כמשתנה סביבה של הפקודה לבדיקה שהודעת ה-Timeout מגיעה מהשרת (`504`).
3. **ביטול:** רענון באמצע טעינה — בדפדפן ה-Fetch מבוטל (נראה ב-Network), ב-Log של השרת אין שגיאה כללית.
4. **PWA:** `npm run build` + `npm run preview` → טעינה ראשונה; בדיקה שה-Service Worker נרשם, שה-Manifest תקין ושהאייקונים נטענים; הדמיית `offline` בדפדפן → מסך Offline; `online` → חזרה עם הנושא והבדיחה; רענון במצב לא מקוון מציג את האפליקציה מה-Cache.
5. **מובייל:** Viewport בגודל טלפון — מסך ה-Offline ממורכז, RTL, בלי גלילה אופקית.
6. סגירת כל ההרצות בסיום.

**בדיקות שהמשתמש יתבקש לבצע ("הרץ כדי שאבדוק"):** ניתוק אמיתי (מצב טיסה / DevTools → Offline), התקנה מהדפדפן בטלפון או במחשב, ואישור האייקון.

---

## 8. מגבלות ידועות שיש לציין בסיום
- ביטול הוא Best Effort: אם OpenAI כבר התחיל לעבד, הקריאה עשויה להיות מחויבת. אין הבטחה שהשרת יעצור.
- `navigator.onLine === true` לא מבטיח שיש אינטרנט אמיתי (למשל Wi-Fi בלי גלישה) — במקרה כזה המשתמש יראה "החיבור נקטע" ולא מסך Offline, בהתאם להגדרה ב-PRD.
- `503 AI_UNAVAILABLE` ממופה בלקוח, אבל השרת יחזיר אותו רק כשה-Circuit Breaker ייבנה ב-Milestone 4.
- `maxDuration: 40` צריך להיתמך בתוכנית ה-Vercel בפועל; בדיקה סופית ב-Milestone 6.

---

## 9. Definition of Done — איך כל סעיף ייבדק

| סעיף | בדיקה |
|---|---|
| כשל API, Timeout, ניתוק וסירוב בנוסחי FR-05; אין יצירה חוזרת אוטומטית | `jokesApi.test.ts`, `App.test.tsx`, `jokeHandler.test.ts`; `maxRetries: 0` נבדק |
| אחרי כשל נשמרים נושא ובדיחה; ניסיון ידני | `App.test.tsx` |
| Timeout ~30 שניות מהשרת (28s), רשת ביטחון של 35s בלקוח | בדיקות שרת + Fake Timers בלקוח |
| רענון/סגירה מפעילים ניסיון ביטול, ללא הבטחה | בדיקת `pagehide` + `request.signal` + בדיקה ידנית ב-Network |
| Offline אחרי טעינה ראשונה; חזרה עם נושא ובדיחה | `App.test.tsx` + `build`/`preview` עם הדמיית ניתוק |
| כשל רשת בודד כשיש חיבור → "החיבור נקטע" במסך הראשי | `App.test.tsx` |
| Manifest עם 192/512/maskable; אישור אייקון | בדיקת `dist/manifest.webmanifest` + הצגה למשתמש |
| ניתן להתקנה; אין כפתור התקנה; אין Cache ל-`/api/*` או לבדיחות | בדיקת `sw.js`, חיפוש `beforeinstallprompt` בקוד, Manifest תקין ב-preview |
