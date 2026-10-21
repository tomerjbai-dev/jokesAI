# ARCHITECTURE — בדיחומט

**תאריך מחקר:** 21 באוקטובר 2026  
**מסמך מקור:** `PRD.md`  
**ייעוד:** ארכיטקטורה ל-MVP של אפליקציית PWA ליצירת בדיחות בעברית באמצעות GPT-5.

## 1. Technology Stack שנבחר

| רכיב | טכנולוגיה | תפקיד |
|---|---|---|
| Frontend | React + TypeScript + Vite | ממשק Mobile First, ניהול מצב והפקת קובצי Web סטטיים |
| עיצוב | CSS רגיל עם CSS Variables | ממשק RTL, צבעוני ומשעשע, ללא תלות בספריית UI גדולה |
| PWA | Web App Manifest + Service Worker באמצעות `vite-plugin-pwa` | התקנה מהדפדפן, Cache של מעטפת האפליקציה ומסך Offline |
| Backend | Vercel Functions (Node.js LTS + TypeScript) | REST API, Validation, אבטחה וחיבור ל-AI |
| AI | OpenAI Responses API, מודל `gpt-5`, SDK רשמי | יצירת בדיחה קצרה בעברית בצד השרת בלבד |
| State תפעולי | זיכרון זמני בכל Function Instance + Cookie חתום | אכיפת Best Effort בלבד למכסות, Rate Limiting ו-Circuit Breaker; ללא Database |
| נתונים מקומיים | Cookie חתום למזהה ולמונה אישי + Local Storage לאישור גיל | שמירת זיהוי בדפדפן והצהרת 18+ |
| Hosting | Vercel Project אחד | Frontend סטטי ו-Serverless Functions באותו Origin |
| Source Control ו-CI | GitHub + GitHub Actions | בדיקות, TypeScript checks ו-Build לפני פריסה |
| Deployment | Vercel Git Integration | Preview Deployments ופריסה אוטומטית מענף `main` |
| ניטור | Structured application logs + Vercel logs | מדדים תפעוליים ללא תוכן בדיחות ונושאים |

### 1.1 החלטות ונימוקים

- **React + Vite + TypeScript:** Frontend קטן, סטטי ומותאם Mobile First; ללא צורך ב-SSR. נבחנו גם Next.js ו-Vue. React/Vite מאפשרים פריסה פשוטה ב-Vercel ללא Framework שרת נוסף.
- **Vercel Functions במקום Express מתמשך:** פונקציות TypeScript תחת `/api` עם SDK רשמי של OpenAI; אין צורך בשרת קבוע או ב-Express. Vercel מחובר ל-GitHub ומפרסם Frontend ו-API יחד.
- **ללא Database, Redis, Supabase, Authentication Provider או Object Storage:** אין חשבונות, קבצים או מידע עסקי קבוע. המחיר הוא ויתור מפורש על אכיפה קשיחה של מכסות בין Invocations, Instances ומכשירים.
- **State חתום בצד לקוח + זיכרון זמני:** Cookie חתום ו-HttpOnly יכול להחזיק מזהה אנונימי ומונה הצלחות אישי, אך בקשות מקבילות, שימוש חוזר ב-Cookie ישן או מחיקת Cookies מאפשרים עקיפה. מונה גלובלי אינו יכול להיות אמין ללא State משותף; זיכרון מקומי של Function הוא Best Effort בלבד.
- **PWA:** `vite-plugin-pwa` שומר App Shell בלבד; אין Cache של API או בדיחות.

### 1.2 פערי אכיפה וסיכונים שאושרו

1. **המכסות הן יעדי Best Effort ולא גבולות מובטחים.** מגבלת 20 בדיחות אישית תיאכף ככל האפשר לפי Cookie חתום, ומגבלת 100 בדיחות גלובלית תיאכף רק בתוך מופע Function חי. אין דרך להבטיח 100 בדיחות לכל האפליקציה ביממה ללא מאגר State משותף.
2. **אין אטומיות בין בקשות מקבילות.** בקשות שמתחילות עם אותו Cookie עלולות כולן לעבור בדיקה; תגובות מתחרות עלולות לדרוס עדכוני Cookie. אין להציג אכיפה קשיחה כיכולת קיימת. החלטת המשתמש להעדיף Vercel ללא Database גוברת על דרישת האכיפה הקשיחה הקודמת ב-PRD; זו סטייה מפורשת מה-PRD.
3. **אין הבטחת המשכיות בין Instances או Deployments.** כל Instance רשאי להתחיל עם מונה גלובלי ו-Circuit Breaker ריקים. אין דרך לדעת שהמכסה הגלובלית מוצתה בכל המערכת או להשבית באופן אמין את הכפתור לכל המשתמשים.
4. **Rate Limiting של 5 בדקה ו-Circuit Breaker של 5 כשלים/2 דקות הם Best Effort בלבד.** הם מגנים רק על Instance ספציפי; זיהוי לפי Cookie אינו עמיד בפני יצירת מזהים חדשים. יש לשקול הגנות מובנות של Vercel ככל שהן זמינות בתוכנית, ללא הבטחה שהן מממשות מכסה אישית.
5. **סיכון כספי:** 100 הצלחות אינן תקרת API, ובקשות כושלות/מנותקות עשויות להיות מחויבות. יש להגדיר תקציב והתראות בספק OpenAI, להבין שהתראות אינן בהכרח Hard Stop, ולעקוב אחר שימוש בפועל.
6. **Cookie אינו אימות זהות.** מחיקה, דפדפן אחר ו-Replay מאפשרים עקיפה. אין Fingerprinting פולשני. הצהרת 18+ אינה אימות גיל.
7. **Timeout:** יש לוודא בהגדרות Vercel שהתוכנית ומשך ה-Function המרבי תומכים ב-30 שניות לפחות, עם מרווח לסיום תשובת HTTP. אין להניח זמינות קבועה בכל תוכנית.

## 2. ארכיטקטורת המערכת

### 2.1 מבנה כללי

```text
Browser / PWA (React + Vite, RTL)
  ├── Service Worker: App Shell / Offline
  ├── Local Storage: ageConfirmed
  └── HTTPS Same-Origin /api/* + signed HttpOnly Cookie
                    │
                    ▼
              Vercel Project
  ├── Static Frontend (CDN)
  └── Node.js Serverless Functions (/api/*)
       ├── Input Validation / Origin Checks
       ├── Signed Cookie Personal Counter (Best Effort)
       ├── Instance-local Global Counter + Rate Limiter
       ├── Instance-local Circuit Breaker
       ├── Joke Service / OpenAI SDK
       └── Privacy-safe Logs
                    │
                    ▼
             OpenAI Responses API
                   gpt-5
```

### 2.2 Modules ואחריות

**Frontend:** מסך גיל 18+, מסך פתיחה, תיבת נושא, יצירת בדיחה, הצגת בדיחה אחת, מונה אישי משוער, טעינה, שגיאות, Offline ו-PWA. `AbortController` משמש לביטול Best Effort. אין שמירת בדיחות בין פתיחות.

**Backend Functions:** `GET /api/status` מחזיר מכסה אישית משוערת ומצב שירות מקומי; `POST /api/jokes` מאמת קלט, בודק הגבלות Best Effort, מפעיל GPT-5 ומחזיר בדיחה; `GET /api/health` לבדיקת חיות. מודולים משותפים: Validation, Cookie signing, Quota guards, AI adapter, Circuit Breaker, Error mapping ו-Telemetry. אין Express Server מתמשך.

### 2.3 Data Model ואחסון

| ישות | מיקום | אורך חיים / מגבלה |
|---|---|---|
| `AnonymousUsage` (`id`, `dayKey`, `successCount`, `issuedAt`) | Cookie חתום, HttpOnly, Secure, SameSite=Lax | נשמר בין ביקורים; ניתן למחיקה או Replay; אינו מונה אטומי |
| `GlobalUsageEstimate` (`dayKey`, `successCount`) | זיכרון Function Instance | אינו משותף ואינו שורד החלפת Instance |
| `RateWindow` (`anonymousId`, timestamps) | זיכרון Function Instance | חלון 60 שניות; Best Effort |
| `CircuitState` (`failures`, `openedAt`, `probeInFlight`) | זיכרון Function Instance | Best Effort, אינו משותף |
| `LastJoke` | זיכרון React | נשלח בבקשה הבאה רק לשם גיוון; לא נשמר |
| `AgeConsent` | Local Storage | Boolean, אינו אימות גיל |

אין Database, Redis, Object Storage או שמירת נושאים ובדיחות בשרת. `dayKey` מחושב לפי `Asia/Jerusalem`, כולל שעון קיץ. ה-Cookie חתום ב-HMAC עם Secret שרת; אין לסמוך על שדות מונה או מזהה שנשלחים כ-JSON. Cookie יכול לשמר מונה בין פתיחות באותו דפדפן, אך אינו מונע Replay של ערך קודם או מירוצים בין תגובות. `Set-Cookie` מחזיר את המונה המעודכן רק עם הצלחה. יש להגביל את גודל ה-Cookie ואת זיכרון ה-Maps ולנקות רשומות ישנות.

### 2.4 API Contracts

| Method + Endpoint | בקשה | תגובה |
|---|---|---|
| `GET /api/status` | Cookie אופציונלי | `{ remainingToday, dailyLimit, globalAvailableEstimate, retryAfterSeconds? }` |
| `POST /api/jokes` | `{ topic: string, previousJoke?: string }` | `{ joke, remainingToday }` + `Set-Cookie` חתום |
| `GET /api/health` | ללא נתונים | `200` ללא Secrets |

שגיאות בפורמט `{ code, message, retryAfterSeconds? }`: `400 INVALID_TOPIC`, `413 PAYLOAD_TOO_LARGE`, `422 UNSUPPORTED_TOPIC`, `429 RATE_LIMITED`, `429 PERSONAL_QUOTA_EXCEEDED`, `429 GLOBAL_QUOTA_EXCEEDED` (רק כאשר Instance הנוכחי מזהה חריגה), `503 AI_UNAVAILABLE`, `504 AI_TIMEOUT`, `500 INTERNAL_ERROR`. כל הודעות ה-UI בעברית. `Cache-Control: no-store` לכל `/api/*`.

`GET /api/status` אינו מסוגל לספק מצב גלובלי סמכותי. אין להציג מונה גלובלי מדויק למשתמש; `globalAvailableEstimate` הוא רמז תפעולי בלבד. המונה האישי המוצג הוא הערכה המבוססת על Cookie עדכני.

### 2.5 מכסות ומקביליות — Best Effort

**ערכי Configuration:** `PERSONAL_DAILY_LIMIT=20`, `GLOBAL_DAILY_LIMIT=100`, `RATE_LIMIT_PER_MINUTE=5`, `AI_TIMEOUT_MS=30000`, `CIRCUIT_FAILURE_THRESHOLD=5`, `CIRCUIT_OPEN_MS=120000`.

1. בקשת יצירה מאמתת `Origin`, JSON, נושא עד 100 תווים, ורווחים בלבד כשגיאה. נושא ריק לחלוטין יוצר בדיחה כללית.
2. מפענחים Cookie חתום; בהיעדרו מנפיקים מזהה חדש. בודקים מונה אישי מה-Cookie, מונה גלובלי מקומי, Rate Limiting מקומי ו-Circuit Breaker מקומי. בדיקות אלה אינן אטומיות בין Instances.
3. רק בדיחה מוצלחת מגדילה את המונה האישי המוחזר ב-Cookie ואת המונה הגלובלי המקומי. שגיאה, סירוב או Timeout אינם נחשבים להצלחה. ספירת בקשות Rate Limiting כוללת ניסיונות יצירה תקינים גם אם נכשלו בהמשך.
4. בעת הגעה למגבלה שנצפתה, מחזירים הודעת מכסה מתאימה ומשביתים כפתור לפי מצב הלקוח. בחצות ישראל מתאפסים מונים לפי `dayKey`; State מקומי עשוי להתאפס מוקדם יותר בכל החלפת Instance.
5. אין להציג Lock/Reservation מקומי כפתרון למירוצים בין Functions. גם Cookie חתום אינו מבטיח מכסה אישית קשיחה. לא ניתן לספק Exactly-Once או מכסה גלובלית אמינה במודל שנבחר.
6. ביטול בעת רענון/סגירה נעשה Best Effort. אם אין תשובה מוצלחת, לא מעדכנים מונה; קריאת OpenAI שכבר החלה עשויה עדיין להיות מחויבת.
7. חריגה ממשאבים או כשל Validation תטופל ללא קריאת OpenAI. הגנות מובנות של Vercel יכולות לשמש שכבת הגנה נוספת אם זמינות, אך אינן מחליפות State משותף.

**פשרת מוצר מתועדת:** בחירת Vercel ללא Database פירושה שלא ניתן לקיים במלואן את דרישות ה-PRD לאכיפה קשיחה של 20/100 הצלחות, לאיפוס עקבי בלבד בחצות ול-Circuit Breaker גלובלי. ה-Implementation חייב לתעד ולבדוק את המגבלה, ולא להציג אותה כפתורה.

### 2.6 יצירת בדיחה ב-GPT-5

- הקריאה נעשית **רק ב-Backend** עם `OPENAI_API_KEY` מ-Environment Secret.
- מודל: `gpt-5` בדיוק, כפי שהוגדר ב-PRD; אין החלפה אוטומטית למודל זול יותר ללא שינוי דרישה.
- System/Developer Instructions קבועים בצד השרת: בדיחה בעברית בלבד, 1–3 משפטים, הומור למבוגרים בכפוף לכללי הבטיחות, נושא שסופק או בדיחה כללית, ללא הקדמות או כותרות, וניסיון להימנע מחזרה על `previousJoke`.
- הנושא והבדיחה הקודמת נחשבים **נתונים לא מהימנים** ולא הוראות מערכת; אין להרשות להם לשנות את הכללים או להיחשף לסודות.
- מגבילים את גודל הפלט ואת משך הבקשה. תשובה ריקה, סירוב או פורמט בלתי תקין אינם בדיחה מוצלחת.
- סירוב בטיחות מוצג כהודעה משעשעת; **אינו** נספר ככשל תשתיתי עבור Circuit Breaker. שגיאות תקשורת, Timeout ושגיאות שירות OpenAI מתאימות לספירת כשלים; שגיאות Validation אינן נספרות.
- אין Retry אוטומטי ליצירת בדיחה, בהתאם ל-PRD. ניסיון חוזר הוא ידני בלבד.

### 2.7 Circuit Breaker

- `closed`: שירות רגיל. כל הצלחת AI מאפסת את מונה השגיאות הרצופות; כשל תשתיתי מעלה אותו.
- לאחר **5 כשלי API רצופים**, עוברים ל-`open` למשך **120 שניות**; בקשות חדשות מקבלות `503` ללא קריאת AI.
- לאחר ההשהיה עוברים ל-`half-open`: **בקשת בדיקה אחת בלבד** רשאית להגיע ל-AI; שאר הבקשות מקבלות הודעת המתנה.
- הצלחת בדיקה מחזירה ל-`closed`; כישלון מחזיר ל-`open` לעוד 120 שניות.
- מצב המנגנון נשמר בזיכרון של כל Function Instance בנפרד; אין Circuit Breaker גלובלי, והמצב יכול להתאפס בכל החלפת Instance.

### 2.8 UX, Offline ו-PWA

- `lang="he"`, `dir="rtl"`; רכיבי Form מותאמים לנייד, תוויות והודעות בעברית.
- `manifest` עם `name: "בדיחומט"`, `short_name: "בדיחומט"`, `display: "standalone"`, `start_url: "/"`, אייקונים תקינים ו-Theme Color.
- Service Worker שומר רק App Shell, Assets ומסך Offline. אין Cache של `/api/*`, בדיחות או תוצאות AI.
- Offline: מסך עם "אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב." וכפתור "נסה שוב"; אין יצירה ללא אינטרנט.
- בכניסה ראשונה הצהרת 18+; ללא אישור אין שימוש. אישור נשמר ב-Local Storage. אין אימות גיל ממשי.
- בזמן יצירה נועלים את שדה הנושא והכפתור, מציגים "ממציאים לך בדיחה..." ומשאירים את הבדיחה הקודמת עד להצלחה.
- כפתור Enter במקלדת שולח את הבקשה. בדיחה חדשה מחליפה קודמת; אין היסטוריה, שיתוף או העתקה.
- בפתיחה מחדש מוצג מסך פתיחה עם נושא ריק וללא בדיחה קודמת; המכסה האישית המשוערת נשמרת דרך Cookie חתום בין ביקורים, בכפוף למגבלות Replay ומקביליות.
- הודעות ה-PRD נשמרות בנוסחן העברי: הודעת סיום מכסה אישית, סיום מכסה כללית, Rate Limiting, רווחים בלבד וסירוב תוכן.

### 2.9 אבטחה ופרטיות

- HTTPS בלבד; מפתחות OpenAI וסודות Cookie אינם נשלחים ל-Bundle של Vite או ללקוח.
- Cookie מזהה חתום, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`; זיהוי השרת נגזר רק מ-Cookie מאומת ולא מ-ID חופשי בגוף הבקשה.
- הגנת CSRF לבקשות שינוי מצב באמצעות בדיקת `Origin` מול Domain מאושר ובדיקת `Content-Type: application/json`, בנוסף ל-SameSite. הגדרת CORS סגורה כברירת מחדל.
- מגבלת גודל Body, Input Validation, Security Headers ו-Content Security Policy מותאמת ל-Vite ול-PWA.
- הזרקת תוכן AI כטקסט בלבד (ללא `dangerouslySetInnerHTML`); לא מריצים HTML/Markdown שמוחזר מהמודל.
- לא שומרים Prompt, נושא, בדיחה, Cookie גולמי או כתובת IP בלוגים ייעודיים. יש לבדוק בנפרד את מדיניות Access Logs של ספק Hosting ואת מדיניות שמירת הנתונים של OpenAI.
- אין Authentication או Authorization של חשבונות משתמשים; אישור גיל הוא Gate ב-UI ואינו מנגנון זהות.
- יש להפעיל מגבלות תקציב/התראות אצל OpenAI, להגדיר הרשאות API מינימליות ולבצע Rotation של Secrets בעת חשד לדליפה.

### 2.10 תשתיות, Configuration ו-Deployment

**GitHub:** Repository פרטי אחד עם Frontend, Backend Functions ומסמכי האפיון. ענף `main` לפריסת Production. Pull Requests מפעילים CI ו-Preview Deployment. אין להעלות Secrets או קובצי `.env`.

**Vercel:** פרויקט אחד מחובר ל-GitHub; Vite Build יוצר `dist` סטטי ו-`/api` מכיל Node.js Functions ב-TypeScript. יש להגדיר Routing כך ש-`/api/*` לא יופנה ל-SPA fallback. Vercel יוצר Preview לכל Pull Request ו-Production Deploy לאחר Merge ל-`main`. ניתן להשתמש ב-GitHub Actions לבדיקות TypeScript, Lint ו-Unit Tests לפני Merge; הגנות ענף מונעות Merge כשהבדיקות נכשלות.

**סביבות:** מקומית משתמשים ב-Development OpenAI Key נפרד; Secrets של Production נשמרים רק ב-Vercel Environment Variables עבור Production, וסודות Preview מופרדים. `vercel dev` או סביבת Preview מאפשרים בדיקה ללא Docker וללא Database. אין להניח ש-Preview חולק מונים עם Production. Secrets אינם מקבלים prefix `VITE_`.

**Environment Variables — Backend בלבד:**

```dotenv
OPENAI_API_KEY=<secret>
COOKIE_SIGNING_SECRET=<secret>
PERSONAL_DAILY_LIMIT=20
GLOBAL_DAILY_LIMIT=100
RATE_LIMIT_PER_MINUTE=5
AI_TIMEOUT_MS=30000
CIRCUIT_FAILURE_THRESHOLD=5
CIRCUIT_OPEN_MS=120000
APP_TIMEZONE=Asia/Jerusalem
```

**Runtime:** להשתמש ב-Node.js LTS הנתמך ב-Vercel בזמן הפריסה. לוודא שה-Max Duration המוגדר ל-Function גדול מ-30 שניות עם מרווח, ולהגדיר Abort ב-30 שניות. הגבלת העלות של Vercel תלויה בתוכנית ובשימוש בפועל; אין להניח מחיר קבוע או Unlimited Invocations.

**ניטור:** Vercel Runtime Logs עם Request ID, Timestamp, Error Code, Latency ומצב Circuit Breaker מקומי בלבד; ללא נושאים, בדיחות, Cookies או מזהים גולמיים. לבדוק מדיניות Access Logs של הפלטפורמה. אין ממשק ניהול.

### 2.11 בדיקות קבלה טכניות

- תרחישי שימוש רגילים באותו דפדפן מציגים מכסה אישית ומאפסים אותה בחצות ישראל.
- בדיקות מקביליות מדגימות במפורש שייתכנו חריגות; אין Test המבטיח אכיפה קשיחה בין Instances.
- שגיאות וסירובי תוכן אינם מגדילים מונה הצלחות; Timeout הוא 30 שניות.
- Rate Limiting ו-Circuit Breaker נבדקים בתוך אותו Instance, עם תיעוד היעדר עקביות גלובלית.
- Cookie חתום אינו ניתן לזיוף ללא Secret, אך Replay ומחיקת Cookie אינם ניתנים למניעה.
- Offline PWA מציג מסך ייעודי ללא Cache ל-API; תוכן AI מוצג כטקסט בלבד.
- OpenAI API Key אינו נחשף ב-Frontend Bundle; GitHub Push ל-`main` מפעיל Production Deployment.

## 3. עלויות ומגבלות

- **Vercel:** תמחור תלוי בתוכנית, זמן הרצת Functions, מספר קריאות, Bandwidth ושירותים נלווים. יש לבדוק מגבלות ותמחור עדכניים לפני Production.
- **OpenAI GPT-5:** חיוב לפי Tokens; מכסת 100 בדיחות היא Best Effort ואינה תקרת הוצאה. קריאות כושלות עשויות להיות מחויבות.
- **ללא Database:** אין עלות Supabase או Redis, אך אין אכיפה אמינה של מכסות או הגנה קשיחה מפני הוצאות.
- **Scalability:** Vercel יכולה להפעיל Functions מקבילות, אך הדבר מחמיר את חוסר העקביות של מונים מקומיים. אכיפה קשיחה בעתיד תחייב שינוי דרישה והוספת State Store משותף ואטומי.

## 4. מקורות רשמיים

1. [Vercel — Functions](https://vercel.com/docs/functions) — מודל ההרצה, Scalability ומגבלות.
2. [Vercel — Function Duration](https://vercel.com/docs/functions/configuring-functions/duration) — התאמת Timeout לתוכנית.
3. [Vercel — Git Integrations](https://vercel.com/docs/git) — Deployments מ-GitHub ו-Preview.
4. [Vercel — Pricing](https://vercel.com/pricing) — תוכניות ועלויות.
5. [Vercel — Environment Variables](https://vercel.com/docs/environment-variables) — הפרדת Secrets וסביבות.
6. [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy) — Build סטטי.
7. [vite-plugin-pwa — Documentation](https://vite-pwa-org.netlify.app/) — Manifest ו-Service Worker.
8. [OpenAI — Responses API](https://platform.openai.com/docs/api-reference/responses) — יצירת בדיחות ב-Backend.
9. [OpenAI — Pricing](https://openai.com/api/pricing/) — עלויות שימוש ב-GPT-5.

**החלטת ארכיטקטורה:** React + Vite + TypeScript, Vercel Static Hosting ו-Vercel Functions, OpenAI GPT-5 דרך Backend בלבד, ללא Database. המכסות ומנגנוני ההגנה פועלים במתכונת Best Effort בלבד, בהתאם לפשרה שאושרה במפורש.
