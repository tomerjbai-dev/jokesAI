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
| Deployment | Vercel Git Integration | Preview מענף `develop`; Production מענף `main`, שמתעדכן רק בפרסום מפורש |
| ניטור | Structured application logs + Vercel logs | מדדים תפעוליים ללא תוכן בדיחות ונושאים |

### 1.1 החלטות ונימוקים

- **React + Vite + TypeScript:** Frontend קטן, סטטי ומותאם Mobile First; ללא צורך ב-SSR. נבחנו גם Next.js ו-Vue. React/Vite מאפשרים פריסה פשוטה ב-Vercel ללא Framework שרת נוסף.
- **Vercel Functions במקום Express מתמשך:** פונקציות TypeScript תחת `/api` עם SDK רשמי של OpenAI; אין צורך בשרת קבוע או ב-Express. Vercel מחובר ל-GitHub ומפרסם Frontend ו-API יחד.
- **ללא Database, Redis, Supabase, Authentication Provider או Object Storage:** אין חשבונות, קבצים או מידע עסקי קבוע. המחיר הוא ויתור מפורש על אכיפה קשיחה של מכסות בין Invocations, Instances ומכשירים.
- **State חתום בצד לקוח + זיכרון זמני:** Cookie חתום ו-HttpOnly יכול להחזיק מזהה אנונימי ומונה הצלחות אישי, אך בקשות מקבילות, שימוש חוזר ב-Cookie ישן או מחיקת Cookies מאפשרים עקיפה. מונה גלובלי אינו יכול להיות אמין ללא State משותף; זיכרון מקומי של Function הוא Best Effort בלבד.
- **PWA:** `vite-plugin-pwa` שומר App Shell בלבד; אין Cache של API או בדיחות.

### 1.2 פערי אכיפה וסיכונים שאושרו

1. **המכסות הן יעדי Best Effort ולא גבולות מובטחים.** מגבלת 20 בדיחות אישית תיאכף ככל האפשר לפי Cookie חתום, ומגבלת 100 בדיחות גלובלית תיאכף רק בתוך מופע Function חי. אין דרך להבטיח 100 בדיחות לכל האפליקציה ביממה ללא מאגר State משותף.
2. **אין אטומיות בין בקשות מקבילות.** בקשות שמתחילות עם אותו Cookie עלולות כולן לעבור בדיקה; תגובות מתחרות עלולות לדרוס עדכוני Cookie. אין להציג אכיפה קשיחה כיכולת קיימת. ה-PRD עודכן ומגדיר את המכסות כ-Best Effort, כך שאין כאן סטייה מה-PRD.
3. **אין הבטחת המשכיות בין Instances או Deployments.** כל Instance רשאי להתחיל עם מונה גלובלי ו-Circuit Breaker ריקים. אין דרך לדעת שהמכסה הגלובלית מוצתה בכל המערכת או להשבית באופן אמין את הכפתור לכל המשתמשים.
4. **Rate Limiting של 5 בדקה ו-Circuit Breaker של 5 כשלים/2 דקות הם Best Effort בלבד.** הם מגנים רק על Instance ספציפי. Rate Limiting נספר גם לפי מזהה ה-Cookie וגם לפי כתובת IP, כך שמחיקת Cookie אינה מאפסת אותו; משתמשים שחולקים כתובת IP חולקים גם את המגבלה. יש לשקול הגנות מובנות של Vercel ככל שהן זמינות בתוכנית, ללא הבטחה שהן מממשות מכסה אישית.
5. **סיכון כספי:** 100 הצלחות אינן תקרת API, ובקשות כושלות/מנותקות עשויות להיות מחויבות. **מגבלת התקציב ב-OpenAI היא ההגנה העיקרית על העלות** (לפי ה-PRD). יש להגדיר בפרויקט OpenAI את מגבלת התקציב המחמירה ביותר שזמינה, לבדוק אם היא עוצרת בקשות בפועל או רק שולחת התראה, ולעקוב אחר השימוש.
6. **Cookie אינו אימות זהות.** מחיקה, דפדפן אחר ו-Replay מאפשרים עקיפה. אין Fingerprinting פולשני. הצהרת 18+ אינה אימות גיל.
7. **Timeout:** השרת עוצר את הקריאה למודל אחרי 28 שניות (`AI_TIMEOUT_MS=28000`) ומחזיר `504 AI_TIMEOUT`; הלקוח מחכה עד 35 שניות כרשת ביטחון, למקרה שהשרת לא ענה כלל. כך המשתמש רואה בדרך כלל את הודעת "חריגה מזמן" כ-30 שניות אחרי השליחה, ואין מירוץ בין שני מנגנוני Timeout זהים. Max Duration של ה-Function צריך להיות 40 שניות לפחות; יש לוודא שהתוכנית ב-Vercel תומכת בכך.

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
| `RateWindow` (מפתח: `anonymousId` וגם כתובת IP, timestamps) | זיכרון Function Instance | חלון 60 שניות; Best Effort; כתובת IP לא נכתבת ללוגים |
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

**ערכי Configuration:** `PERSONAL_DAILY_LIMIT=20`, `GLOBAL_DAILY_LIMIT=100`, `RATE_LIMIT_PER_MINUTE=5`, `AI_TIMEOUT_MS=28000`, `CIRCUIT_FAILURE_THRESHOLD=5`, `CIRCUIT_OPEN_MS=120000`.

1. בקשת יצירה מאמתת `Origin`, JSON, נושא עד 100 תווים, ורווחים בלבד כשגיאה. נושא ריק לחלוטין יוצר בדיחה כללית.
2. מפענחים Cookie חתום; בהיעדרו מנפיקים מזהה חדש. בודקים מונה אישי מה-Cookie, מונה גלובלי מקומי, Rate Limiting מקומי ו-Circuit Breaker מקומי. בדיקות אלה אינן אטומיות בין Instances.
3. רק בדיחה מוצלחת מגדילה את המונה האישי המוחזר ב-Cookie ואת המונה הגלובלי המקומי. הספירה מתבצעת ברגע שהשרת קיבל בדיחה תקינה מהמודל; אין אישור קבלה מהלקוח. שגיאה, סירוב או Timeout אינם נחשבים להצלחה. ספירת בקשות Rate Limiting כוללת ניסיונות יצירה תקינים גם אם נכשלו בהמשך, ונעשית גם לפי מזהה ה-Cookie וגם לפי כתובת IP; חריגה באחד מהם חוסמת.
4. בעת הגעה למגבלה שנצפתה, מחזירים הודעת מכסה מתאימה ומשביתים כפתור לפי מצב הלקוח. בחצות ישראל מתאפסים מונים לפי `dayKey`; State מקומי עשוי להתאפס מוקדם יותר בכל החלפת Instance.
5. אין להציג Lock/Reservation מקומי כפתרון למירוצים בין Functions. גם Cookie חתום אינו מבטיח מכסה אישית קשיחה. לא ניתן לספק Exactly-Once או מכסה גלובלית אמינה במודל שנבחר.
6. ביטול בעת רענון/סגירה נעשה Best Effort. אם אין תשובה מוצלחת, לא מעדכנים מונה; קריאת OpenAI שכבר החלה עשויה עדיין להיות מחויבת.
7. חריגה ממשאבים או כשל Validation תטופל ללא קריאת OpenAI. הגנות מובנות של Vercel יכולות לשמש שכבת הגנה נוספת אם זמינות, אך אינן מחליפות State משותף.

**פשרת מוצר מאושרת:** בחירת Vercel ללא Database פירושה שאין אכיפה קשיחה של 20/100 הצלחות, אין איפוס עקבי בחצות בין Instances ואין Circuit Breaker גלובלי. ה-PRD עודכן בהתאם. ה-Implementation חייב לתעד ולבדוק את המגבלה, ולא להציג אותה כפתורה.

### 2.6 יצירת בדיחה ב-GPT-5

- הקריאה נעשית **רק ב-Backend** עם `OPENAI_API_KEY` מ-Environment Secret.
- מודל: נקרא ממשתנה הסביבה `OPENAI_MODEL`, שערך ברירת המחדל שלו `gpt-5` לפי ה-PRD. החלפת מודל נעשית בשינוי ההגדרה בלבד, ללא שינוי קוד; אין החלפה אוטומטית למודל אחר.
- **רמת חשיבה:** GPT-5 הוא מודל שמבצע חשיבה (Reasoning) לפני התשובה. יש להגדיר `reasoning.effort` נמוך (`minimal` או `low`) כדי לקצר את זמן התגובה ולהוזיל את הבקשה.
- **מגבלת אורך פלט:** טוקני החשיבה נספרים בתוך `max_output_tokens`. יש לקבוע מגבלה שמשאירה מקום גם לחשיבה וגם לבדיחה, אחרת התשובה עלולה לחזור ריקה. תשובה ריקה או חתוכה (`status: incomplete`) מטופלת ככשל.
- **תשובה במבנה קבוע (Structured Output):** המודל מחזיר JSON לפי סכמה קבועה: `{ status: "joke" | "refused", joke: string }`. `refused` מתורגם ל-`422 UNSUPPORTED_TOPIC` עם הודעת הסירוב מה-PRD. גם תוכן `refusal` שה-API מחזיר, או JSON לא תקין, אינם בדיחה מוצלחת: `refusal` מטופל כסירוב, ו-JSON לא תקין ככשל.
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
- `manifest` עם `name: "בדיחומט"`, `short_name: "בדיחומט"`, `display: "standalone"`, `start_url: "/"`, Theme Color ואייקונים בגדלים 192×192 ו-512×512, כולל גרסת `maskable`, לפי `DESIGN.md` §2.6.
- Service Worker שומר רק App Shell, Assets ומסך Offline. אין Cache של `/api/*`, בדיחות או תוצאות AI.
- Offline: מסך עם "אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב." וכפתור "נסו שוב"; אין יצירה ללא אינטרנט.
- **מתי מוצג מסך Offline:** רק כשהדפדפן מדווח שאין רשת (`navigator.onLine === false` ואירוע `offline`). כשל רשת של בקשה בודדת בזמן שהדפדפן מדווח על חיבור מוצג כהודעת "החיבור נקטע" במסך הראשי, והבדיחה הקודמת נשארת. "נסו שוב" בודק את החיבור; אם יש רשת, חוזרים למסך שהמשתמש היה בו (כולל נושא ובדיחה), וחזרת החיבור (אירוע `online`) מחזירה אוטומטית לאותו מסך.
- בכניסה ראשונה הצהרת 18+; ללא אישור אין שימוש. אישור נשמר ב-Local Storage. אין אימות גיל ממשי.
- בזמן יצירה נועלים את שדה הנושא והכפתור, מציגים "ממציאים לכם בדיחה..." ומשאירים את הבדיחה הקודמת עד להצלחה.
- כפתור Enter במקלדת שולח את הבקשה. בדיחה חדשה מחליפה קודמת; אין היסטוריה, שיתוף או העתקה.
- בפתיחה מחדש מוצג מסך פתיחה עם נושא ריק וללא בדיחה קודמת; המכסה האישית המשוערת נשמרת דרך Cookie חתום בין ביקורים, בכפוף למגבלות Replay ומקביליות.
- הודעות ה-PRD נשמרות בנוסחן העברי: הודעת סיום מכסה אישית, סיום מכסה כללית, Rate Limiting, רווחים בלבד, וכל ההודעות בטבלת נוסחי השגיאה ב-FR-05. מיפוי קודי השגיאה להודעות: `500 INTERNAL_ERROR` → כשל שירות; `504 AI_TIMEOUT` → חריגה מזמן; `503 AI_UNAVAILABLE` → השירות מושהה זמנית; כשל רשת בצד הלקוח → החיבור נקטע; `422 UNSUPPORTED_TOPIC` → סירוב תוכן.

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

**GitHub:** Repository אחד עם Frontend, Backend Functions ומסמכי האפיון. שני ענפים:
- `develop` — ענף העבודה. כל "דחוף לגיטהאב" נדחף אליו, ו-Vercel יוצר ממנו Preview Deployment לבדיקה.
- `main` — הגרסה החיה (Production). מתעדכן רק במיזוג `develop` → `main` בפקודת "פרסם לאוויר" מפורשת של המשתמש (ראה `CLAUDE.md`).

אין להעלות Secrets או קובצי `.env`.

**Vercel:** פרויקט אחד מחובר ל-GitHub; Vite Build יוצר `dist` סטטי ו-`/api` מכיל Node.js Functions ב-TypeScript. יש להגדיר Routing כך ש-`/api/*` לא יופנה ל-SPA fallback. Vercel יוצר Preview לכל דחיפה ל-`develop`, ו-Production Deploy רק לאחר עדכון `main`. GitHub Actions מריץ בדיקות TypeScript ו-Unit Tests על כל דחיפה ל-`develop`; אין למזג ל-`main` כשהבדיקות נכשלות.

**סביבות:** מקומית משתמשים ב-Development OpenAI Key נפרד; Secrets של Production נשמרים רק ב-Vercel Environment Variables עבור Production, וסודות Preview מופרדים. אין להניח ש-Preview חולק מונים עם Production. Secrets אינם מקבלים prefix `VITE_`.

**הרצה מקומית:** מ-Milestone 2 האפליקציה רצה מקומית עם `vercel dev` (Vercel CLI), שמריץ יחד את ה-Frontend ואת ה-Functions תחת `/api`, ללא Docker וללא Database. הדבר דורש חשבון Vercel, התחברות (`vercel login`) וקישור הפרויקט (`vercel link`) — את יצירת החשבון וההתחברות מבצע המשתמש, לפי הנחיה צעד אחר צעד. `vercel dev` קורא את המשתנים מקובץ `.env` המקומי. עד Milestone 2 (ובבדיקות האוטומטיות) ממשיכים להשתמש ב-`npm run dev`.

**Environment Variables — Backend בלבד:**

```dotenv
OPENAI_API_KEY=<secret>
OPENAI_MODEL=gpt-5
COOKIE_SIGNING_SECRET=<secret>
PERSONAL_DAILY_LIMIT=20
GLOBAL_DAILY_LIMIT=100
RATE_LIMIT_PER_MINUTE=5
AI_TIMEOUT_MS=28000
CIRCUIT_FAILURE_THRESHOLD=5
CIRCUIT_OPEN_MS=120000
APP_TIMEZONE=Asia/Jerusalem
```

**Runtime:** להשתמש ב-Node.js LTS הנתמך ב-Vercel בזמן הפריסה. להגדיר Max Duration של 40 שניות לפחות ל-Function, Abort לקריאת המודל ב-28 שניות בשרת, ו-Abort של 35 שניות בלקוח (ראה §1.2 סעיף 7). הגבלת העלות של Vercel תלויה בתוכנית ובשימוש בפועל; אין להניח מחיר קבוע או Unlimited Invocations.

**ניטור:** Vercel Runtime Logs עם Request ID, Timestamp, Error Code, Latency ומצב Circuit Breaker מקומי בלבד; ללא נושאים, בדיחות, Cookies או מזהים גולמיים. לבדוק מדיניות Access Logs של הפלטפורמה. אין ממשק ניהול.

### 2.11 בדיקות קבלה טכניות

- תרחישי שימוש רגילים באותו דפדפן מציגים מכסה אישית ומאפסים אותה בחצות ישראל.
- בדיקות מקביליות מדגימות במפורש שייתכנו חריגות; אין Test המבטיח אכיפה קשיחה בין Instances.
- שגיאות וסירובי תוכן אינם מגדילים מונה הצלחות; Timeout בשרת אחרי 28 שניות, ורשת ביטחון בלקוח אחרי 35 שניות.
- Rate Limiting ו-Circuit Breaker נבדקים בתוך אותו Instance, עם תיעוד היעדר עקביות גלובלית.
- Cookie חתום אינו ניתן לזיוף ללא Secret, אך Replay ומחיקת Cookie אינם ניתנים למניעה.
- Offline PWA מציג מסך ייעודי ללא Cache ל-API; תוכן AI מוצג כטקסט בלבד.
- OpenAI API Key אינו נחשף ב-Frontend Bundle; דחיפה ל-`develop` מפעילה Preview בלבד, ועדכון `main` מפעיל Production Deployment.

## 3. עלויות ומגבלות

- **Vercel:** תמחור תלוי בתוכנית, זמן הרצת Functions, מספר קריאות, Bandwidth ושירותים נלווים. יש לבדוק מגבלות ותמחור עדכניים לפני Production.
- **OpenAI GPT-5:** חיוב לפי Tokens; מכסת 100 בדיחות היא Best Effort ואינה תקרת הוצאה. קריאות כושלות עשויות להיות מחויבות.
- **ללא Database:** אין עלות Supabase או Redis, אך אין אכיפה אמינה של מכסות. ההגנה על ההוצאות היא מגבלת התקציב בחשבון OpenAI.
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

## החלטות מרכזיות (ADRs)

### ADR-1: ניווט מבוסס מצב, ללא Router
**הקשר:** ב-MVP יש מעט מסכים (הצהרת גיל, חסימה, מסך ראשי, ובהמשך Offline), אין כתובות שצריך לשתף, ותוצאת בדיחה היא מצב של המסך הראשי.
**החלטה:** `App.tsx` בוחר את המסך לפי משתנה מצב (`age-gate` / `denied` / `home`), ללא React Router. מצב התחלתי נגזר מאישור הגיל השמור ב-Local Storage (`ageConfirmed`). אי-אישור גיל אינו נשמר.
**השלכות:** אין תלות נוספת ואין צורך ב-SPA fallback מיוחד לנתיבים פנימיים. אם בעתיד יידרשו כתובות נפרדות למסכים — יש להוסיף Router.

### ADR-2: גופן Heebo נארז עם האפליקציה
**הקשר:** DESIGN מגדיר Heebo; מסך ה-Offline (Milestone 3) צריך לעבוד ללא רשת.
**החלטה:** שימוש ב-`@fontsource/heebo` (משקלים 400/500/700) במקום Google Fonts.
**השלכות:** הגופן מוגש מאותו Origin ונכנס ל-Cache של ה-PWA; אין בקשה לשרת חיצוני. מעט יותר קבצים ב-Build.

### ADR-3: Vitest + Testing Library לבדיקות
**הקשר:** נדרשות בדיקות אוטומטיות לזרימות UI, בפרויקט Vite.
**החלטה:** Vitest עם סביבת jsdom, ‏`@testing-library/react` ו-`user-event`. הבדיקות רצות ב-`npm test`.
**השלכות:** אותה תצורת Vite משמשת לבדיקות; בדיקות Backend (Milestone 2 ואילך) ירוצו באותו כלי.

### ADR-4: מבנה ה-Backend — `api/` דק, `server/` ו-`shared/`
**הקשר:** כל קובץ תחת `api/` הופך לכתובת ב-Vercel, אבל הלוגיקה צריכה בדיקות אוטומטיות; כללי הנושא (100 תווים, רווחים בלבד) נדרשים גם בלקוח וגם בשרת.
**החלטה:** `api/jokes.ts` רק מעביר את הבקשה ל-`server/jokeHandler.ts` (חתימת Web `Request → Response`). הלוגיקה, הקריאה ל-OpenAI והבדיקות יושבות ב-`server/`; כללי הנושא ב-`shared/topic.ts`, שמיובא משני הצדדים. קוד השרת נבדק ב-`tsconfig.server.json` (`nodenext`, ייבוא עם סיומת `.js`) כחלק מ-`npm run build`.
**השלכות:** הבדיקות לא נפרסות ככתובות API; כלל Validation אחד לשני הצדדים. ה-Frontend לא מייבא דבר מ-`server/`, ולכן ה-SDK והמפתח לא נכנסים ל-Bundle.

### ADR-5: פרמטרי הקריאה ל-GPT-5
**הקשר:** §2.6 דורש חשיבה נמוכה, מגבלת פלט שמשאירה מקום לחשיבה, תשובה מובנית, והתייחסות לנושא כנתון לא מהימן.
**החלטה:** `reasoning.effort: 'low'` (ולא `minimal`, כדי לתת למודל מעט חשיבה לטובת איכות ההומור); `max_output_tokens: 2000`; `text.format` מסוג `json_schema` עם `strict: true`. הנושא והבדיחה הקודמת נשלחים ב-`input` בתוך התגיות `<topic>` ו-`<previous_joke>`, וההוראות הקבועות ב-`instructions` אומרות שהתוכן בתגיות הוא נתונים בלבד. הבדיחה הקודמת נחתכת ל-500 תווים.
**השלכות:** אם התגובה איטית מדי אפשר לשקול `minimal` בשינוי קוד קטן. תשובה `incomplete`, JSON לא תקין או בדיחה ריקה הם כשל; `refused` או פריט `refusal` הם סירוב (`422`).

### ADR-6: Vercel CLI כתלות פיתוח והרצה מלאה בפורט 3000
**הקשר:** §2.10 קובע הרצה מקומית עם `vercel dev`. `vercel dev` מריץ בעצמו את סקריפט `dev` של הפרויקט (Vite).
**החלטה:** `vercel` מותקן כ-devDependency. `npm run dev:full` מריץ `vercel dev --listen 3000` (ממשק + `/api`); `npm run dev` נשאר `vite` בלבד (לממשק ולבדיקות), כדי ש-`vercel dev` לא יקרא לעצמו בלולאה.
קובץ `vercel.json` בשורש קובע `"framework": "vite"`, כי הפרויקט ב-Vercel נוצר עם Preset ‏"Other" (שגורם ל-`vercel dev` לנסות `yarn` ובפריסה היה מגיש את התיקייה הלא נכונה).
**השלכות:** אין צורך בהתקנה גלובלית; גרסת ה-CLI נעולה ב-`package-lock.json`. ההגדרה ב-`vercel.json` גוברת על הגדרות ה-Dashboard, כך שגם Preview ו-Production יבנו כ-Vite. בהרצה עם `npm run dev` בלבד, יצירת בדיחה מציגה את הודעת הכשל הכללית כי אין `/api`.

### ADR-7: טיפול זמני בשגיאות בלקוח עד Milestone 3
**הקשר:** טבלת השגיאות המלאה, Timeout וביטול בקשות שייכים ל-Milestone 3, אבל ב-Milestone 2 המסך לא יכול להיתקע כשבקשה נכשלת.
**החלטה:** `src/jokesApi.ts` מחזיר תמיד תוצאה ולא זורק שגיאה. בכשל מוצג ה-`message` שהשרת החזיר (למשל הודעת הסירוב), ואם אין כזה (כשל רשת או תשובה לא תקינה) מוצגת `אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.`. הבדיחה הקודמת והנושא נשמרים, והכפתור חוזר לפעול.
**השלכות:** ב-Milestone 3 יש להוסיף מיפוי לפי קוד שגיאה (Timeout, ניתוק, השהיה), `AbortController` ו-Timeout של 35 שניות בלקוח.

### ADR-8: Timeout וביטול בשרת
**הקשר:** §1.2 סעיף 7 ו-§2.6 דורשים Timeout של 28 שניות בשרת, ביטול Best Effort ואין Retry אוטומטי. ה-SDK של OpenAI מבצע כברירת מחדל 2 ניסיונות חוזרים אוטומטיים, ו-Vercel מעביר את `request.signal` רק כשביטול מופעל במפורש.
**החלטה:** לקוח OpenAI נוצר עם `timeout` מ-`AI_TIMEOUT_MS` (ברירת מחדל 28000; ערך ריק או לא תקין → ברירת המחדל) ו-`maxRetries: 0`, ואותם ערכים נשלחים גם ברמת הבקשה יחד עם `signal: request.signal`. `APIConnectionTimeoutError` → `504 AI_TIMEOUT`; `APIUserAbortError` (הלקוח התנתק) → כשל רגיל ללא לוג שגיאה. ב-`vercel.json`: `"api/jokes.ts": { "maxDuration": 40, "supportsCancellation": true }`.
**השלכות:** ביטול הוא Best Effort — קריאת OpenAI שכבר התחילה עשויה להיות מחויבת. יש לוודא ב-Milestone 6 ש-`maxDuration: 40` נתמך בתוכנית ה-Vercel בפועל.

### ADR-9: מיפוי שגיאות בלקוח לפי קוד (מחליף את ADR-7)
**הקשר:** ADR-7 הציג את ה-`message` מהשרת כפתרון זמני עד Milestone 3.
**החלטה:** נוסחי FR-05 וה-Offline יושבים ב-`src/messages.ts`. `src/jokesApi.ts` ממפה לפי `code` (`AI_TIMEOUT`, `AI_UNAVAILABLE`, `UNSUPPORTED_TOPIC`), ומשתמש ב-`message` מהשרת רק עבור `INVALID_TOPIC`; כל השאר → הודעה כללית. `fetch` שנדחה → "החיבור נקטע". רשת ביטחון של 35 שניות בלקוח (`setTimeout` + `AbortController`, כדי שיהיה ניתן לבדוק עם Fake Timers). `Home` מבטל את הבקשה הפעילה ב-`pagehide` וב-Unmount; ביטול כזה מסתיים ללא הודעה.
**השלכות:** הנוסחים מוגדרים גם בשרת וגם בלקוח; הלקוח הוא הקובע מה מוצג.

### ADR-10: מסך Offline כשכבה מעל המסך הנוכחי
**הקשר:** חזרת החיבור צריכה להחזיר למסך הקודם עם הנושא והבדיחה (`DESIGN.md` §1.5), ומסך ה-Offline מוצג רק כשהדפדפן מדווח שאין רשת.
**החלטה:** `useOnlineStatus` עוקב אחרי `navigator.onLine` ואירועי `online`/`offline`. כשאין רשת, `App` מציג את `Offline` ומסתיר (`hidden`) את המסך הנוכחי בלי להסיר אותו, כך שה-State של `Home` נשמר. `נסו שוב` קורא שוב את `navigator.onLine`. Service Worker של `vite-plugin-pwa` (`generateSW`) שומר רק את ה-App Shell (כולל גופני Heebo); אין `runtimeCaching`, וה-`navigateFallback` לא חל על `/api/`.
**השלכות:** Wi-Fi ללא גלישה בפועל נחשב "מחובר", ולכן יוצג "החיבור נקטע" ולא מסך Offline — בהתאם ל-PRD. ה-Service Worker פעיל רק ב-Build (`npm run build` + `npm run preview`), לא ב-`npm run dev` / `dev:full`.

### ADR-11: יצירת אייקונים בסקריפט
**הקשר:** `DESIGN.md` §2.6 דורש את האות `ב` ב-Heebo 700, אבל ספריית ההמרה לתמונות לא מכירה את הגופן.
**החלטה:** `scripts/generate-icons.mjs` (`npm run icons`) ממיר את האות ל-Path בעזרת `opentype.js` מתוך קובץ ה-woff של `@fontsource/heebo`, ומייצר עם `sharp` את `favicon.svg`, ‏`pwa-192x192.png`, ‏`pwa-512x512.png`, ‏`pwa-maskable-512x512.png` ו-`apple-touch-icon.png` ב-`public/`.
**השלכות:** הקבצים שנוצרו נשמרים בפרויקט; אין צורך להריץ את הסקריפט ב-Build. `opentype.js` ו-`sharp` הן devDependencies בלבד.
