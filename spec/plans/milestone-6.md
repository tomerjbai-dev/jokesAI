# Milestone 6 — בדיקות קבלה ופריסה ל-Production

**מקורות:** `MILESTONES.md` (Milestone 6), `ARCHITECTURE.md` §1.2, §2.4, §2.9–§2.11, ADR-8, ADR-15, ADR-16, ADR-17, ADR-18, ADR-19; `PRD.md` FR-03–FR-07; `CLAUDE.md` (פקודות דחיפה ופרסום).

## 1. מצב נוכחי (נבדק בקוד וב-git)

- `develop` (מקומי ו-`origin/develop`) מכיל את Milestones 1–5. `main` ב-GitHub מכיל רק את קובצי התבנית (2 Commits) ו-`develop` נגזר ממנו — לכן מיזוג `develop` → `main` יהיה Fast-forward. **עדיין לא פורסם דבר ל-Production.**
- הפרויקט כבר מקושר מקומית ל-Vercel Project בשם `jokesai` (`.vercel/project.json`, מ-Milestone 2). לא ידוע אם ה-Project מחובר ל-GitHub Repository (`tomerjbai-dev/jokesAI`) — ייבדק עם המשתמש.
- `vercel.json`: `framework: vite`, `api/jokes.ts` עם `maxDuration: 40` ו-`supportsCancellation`, ו-Security Headers. אין Rewrites ל-SPA.
- אין `.github/workflows` (אין CI).
- `GET /api/health` מופיע ב-API Contracts (§2.4) אך **לא מומש** — קיימים רק `api/jokes.ts` ו-`api/status.ts`.
- אין `engines.node` ב-`package.json`; מקומית Node 24.
- `gh` (GitHub CLI) אינו מותקן — מצב ה-CI ייבדק בדף Actions ב-GitHub (דרך הדפדפן המובנה או על ידי המשתמש).
- `.env.example` מכיל רק `OPENAI_API_KEY` (ADR-19); כל שאר ההגדרות אופציונליות עם ברירות מחדל בקוד.

## 2. גישה

ה-Milestone מתחלק לשלושה שלבים, לפי מחזור העבודה ב-`CLAUDE.md`:

1. **בנייה מקומית (Claude):** CI, Routing, `/api/health`, נעילת גרסת Node, בדיקת סודות — כולם נבדקים מקומית (`npm test`, `npm run build`).
2. **Preview (דורש אישור Push מהמשתמש):** חיבור Vercel ל-GitHub והגדרת משתני סביבה (המשתמש, בהדרכה צעד אחר צעד) → Push ל-`develop` → CI ו-Preview Deployment → בדיקות End-to-End על ה-Preview → סימון 🟡.
3. **Production (רק בפקודת "פרסם לאוויר"):** אחרי שהמשתמש מאשר את ה-🟡 (בדחיפה או באישור מפורש) — מיזוג `develop` → `main`, פריסה, ובדיקות על האתר החי.

> לפי `CLAUDE.md`, "פרסם לאוויר" אינו מותר כשיש Milestone עם 🟡. לכן סעיפי ה-DoD שעוסקים ב-Production ייבדקו **אחרי** אישור ה-Milestone והפרסום, וידווחו בנפרד. אם יתגלה באג ב-Production — התיקון נעשה ב-`develop`, נבדק ב-Preview ורק אז מפורסם שוב.

אין שינוי בהתנהגות המוצר, ב-UI או במסמכי PRD/DESIGN. אין Database, Redis או שירות חדש.

## 3. קבצים ליצירה / שינוי

### 3.1 `.github/workflows/ci.yml` (חדש)
- מופעל ב-`push` לענף `develop` וב-`pull_request` ל-`main` (וגם `push` ל-`main`, כדי לראות את מצב הגרסה החיה).
- `ubuntu-latest`, `actions/setup-node` עם `node-version: 24` ו-`cache: npm`.
- שלבים: `npm ci` → `npm test` → `npm run build` (כולל `tsc -b` של הלקוח והשרת) → בדיקת סודות (3.5).
- אין שימוש ב-Secrets ב-CI: הבדיקות לא קוראות ל-OpenAI (משתמשות ב-Fake client).
- **סיכון ידוע:** `package-lock.json` נוצר ב-Windows. אם `npm ci` ב-Linux ייכשל בגלל חבילה מקומית חסרה (למשל Binding של Rolldown/Vite או `sharp`), הפתרון: הוספת החבילה החסרה של Linux כ-`optionalDependencies` או יצירה מחדש של ה-Lockfile — לא ביטול הבדיקה.

### 3.2 `vercel.json` (שינוי)
- הוספת Rewrite ל-SPA שאינו נוגע ב-`/api`:
  `"rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]`
  ב-Vercel קבצים קיימים מוגשים לפני Rewrites, כך שה-Assets, ה-Manifest וה-Service Worker לא מושפעים. כתובת לא קיימת (למשל `/abc`) תציג את האפליקציה במקום 404 של Vercel, ו-`/api/לא-קיים` יחזיר 404 אמיתי.
- הוספת `"api/health.ts"` אינה נדרשת ב-`functions` (ברירת המחדל מספיקה).
- `vite.config.ts` קורא את `vercelConfig.headers[0]` — ההוספה לא משנה את המבנה הזה.

### 3.3 `api/health.ts` + `server/healthHandler.ts` + בדיקה (חדש)
- `GET /api/health` → `200 { status: "ok" }` עם `Cache-Control: no-store` (דרך `json()` מ-`server/http.ts`), בלי Secrets, בלי גרסה, בלי קריאה ל-OpenAI ובלי Cookie.
- לפי מבנה ADR-4: `api/health.ts` דק, הלוגיקה ב-`server/`. בדיקה קצרה ב-`server/healthHandler.test.ts` (סטטוס, גוף, `no-store`, אין `Set-Cookie`).
- לא נרשם בלוגים התפעוליים (כמו `/api/status`, ADR-18).
- משמש לבדיקת חיות מהירה של כל Deployment.

### 3.4 `package.json` (שינוי)
- `"engines": { "node": "24.x" }` — Vercel משתמש בה לבחירת גרסת Node של ה-Functions, כך שהיא זהה למקומית ול-CI (Node LTS, §2.10).

### 3.5 בדיקת סודות (בתוך ה-CI)
- אחרי ה-Build: חיפוש ב-`dist/` של `OPENAI_API_KEY`, `COOKIE_SIGNING_SECRET`, `BUILT_IN_COOKIE_SECRET` ותבנית מפתח OpenAI (`sk-` ואחריו 20+ תווים). נמצא → ה-CI נכשל.
- חיפוש אותה תבנית מפתח בקובצי ה-Repository (`git grep`). נמצא → ה-CI נכשל.
- כ-step קצר של Shell ב-Workflow; אין צורך בסקריפט נפרד. אותה בדיקה תורץ גם מקומית לפני ה-Push.
- נבדק גם שאין קובץ `.env` ב-git (`git ls-files`) — `.gitignore` כבר מכסה זאת.

### 3.6 `spec/ARCHITECTURE.md` — ADRs חדשים (מותר לפי `CLAUDE.md`)
- **ADR-21:** CI ב-GitHub Actions — מה רץ, מתי, ובדיקת הסודות.
- **ADR-22:** Rewrite ל-SPA ונקודת `/api/health`.
- **ADR-23:** נעילת Node 24 ב-`engines`.
- **ADR-24 (בסוף ה-Milestone):** ממצאי הפלטפורמה בפועל — תוכנית Vercel ו-`maxDuration`, זמן שמירת הלוגים, HSTS, התאמת `Origin` בדומיין של Vercel.

### 3.7 `CLAUDE.md` — "פקודות הרצה"
- הוספת שורה: כתובת ה-Preview (מ-Vercel, לענף `develop`) וכתובת ה-Production, ואיפה רואים לוגים (Vercel → Project → Logs). רק אחרי שהכתובות ידועות.

### 3.8 `spec/MILESTONES.md`
- 🟡 ליד הכותרת של Milestone 6 אחרי שבדיקות ה-Preview עברו.

## 4. צעדים שהמשתמש מבצע (בהדרכה צעד אחר צעד)

Claude עוצר בכל אחד מאלה ומסביר בשפה פשוטה מה ללחוץ:

1. **חיבור Vercel ל-GitHub:** ב-Vercel → Project `jokesai` → Settings → Git → Connect Git Repository → `tomerjbai-dev/jokesAI` (כולל התקנת אפליקציית Vercel ב-GitHub אם נדרש).
2. **ענף Production:** Settings → Environments → Production → Branch = `main`. כל ענף אחר (כלומר `develop`) יוצר Preview.
3. **משתני סביבה** (Settings → Environment Variables):
   - `OPENAI_API_KEY` — אותו מפתח ל-Preview ול-Production (החלטת המשתמש, §9), מסומן Sensitive.
   - `OPENAI_MODEL` — לא מוגדר (החלטת המשתמש); הקוד משתמש בברירת המחדל `gpt-5`. לבדיקת ה-Circuit Breaker (§5.3) יוגדר זמנית ב-Preview בלבד.
   - `COOKIE_SIGNING_SECRET` — לא מוגדר (החלטת המשתמש, §9); נשאר הסוד המובנה.
   - שאר ההגדרות (מכסות, Rate Limiting, Timeout, Circuit Breaker) — לא מוגדרות, כך שחלות ברירות המחדל.
4. **מגבלת תקציב ב-OpenAI — לא מוגדרת** (החלטת המשתמש, §9). אין צעד כזה.
5. **אישור Push** ל-`develop` (נדרש כדי ליצור Preview — לפי `CLAUDE.md`, Claude מבקש אישור לפני ה-Push).
6. **בדיקה בטלפון:** פתיחת ה-Preview / Production בטלפון, התקנה כ-PWA ובדיקת Offline (Claude נותן רשימה קצרה).

> Preview Deployments ב-Vercel מוגנים כברירת מחדל ב-Vercel Authentication — רק מי שמחובר לחשבון Vercel רואה אותם. זה רצוי. כדי ש-Claude יבדוק בדפדפן המובנה, המשתמש מתחבר שם ל-Vercel פעם אחת. Production יהיה ציבורי.

## 5. בדיקות על ה-Preview (Claude, בדפדפן המובנה + המשתמש בטלפון)

### 5.1 תשתית
- ה-CI ירוק ב-GitHub Actions; נוצר Preview Deployment מ-`develop`, ו-**לא** נוצר Production Deployment.
- `/api/health` → 200; `/api/status` → JSON עם `no-store`; כתובת לא קיימת מציגה את האפליקציה; `/api/xyz` → 404.
- Response Headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, ו-**HSTS** (`Strict-Transport-Security`, מתווסף אוטומטית ב-Vercel — לבדוק); תגית ה-CSP קיימת ב-HTML ואין שגיאות CSP ב-Console.
- **Origin (ADR-16):** יצירת בדיחה עובדת בדומיין של ה-Preview (כלומר `new URL(request.url).origin` תואם ל-Origin של הדפדפן). אם לא — עוצרים ומדווחים; הפתרון המתוכנן ב-ADR-16 הוא רשימת דומיינים מאושרים במשתנה סביבה.
- Cookie `bdichomat_usage` מתקבל עם `HttpOnly; Secure; SameSite=Lax`.
- חיפוש מחרוזות המפתח בקובצי ה-JS שהדפדפן הוריד — לא נמצאו.

### 5.2 תרחישי הליבה מה-PRD
אישור גיל / חסימה / חזרה · רענון שומר אישור גיל · יצירה עם נושא בעברית ובאנגלית · נושא ריק → בדיחה כללית · רווחים בלבד → הודעה ללא בקשה · 100 תווים מקסימום · Enter = לחיצה · טעינה נועלת שדה וכפתור והבדיחה הקודמת נשארת · יתרה מוצגת ויורדת אחרי הצלחה · פתיחה מחדש מאפסת נושא ובדיחה ושומרת אישור גיל ויתרה · Offline אחרי טעינה ראשונה (ניתוק ב-DevTools / מצב טיסה בטלפון) ו"נסו שוב" · PWA ניתנת להתקנה (Manifest + Service Worker פעיל), אין כפתור התקנה · ב-Network אין Cache של `/api/*`.

### 5.3 מגבלות Best Effort בפלטפורמה האמיתית (ADR-15)
- **Rate Limiting:** 6 בקשות מהירות → הודעת `רגע, גם לקומיקאי מגיע לנשום 😅` עם ספירה לאחור. אם בקשות הגיעו ל-Instances שונים והחסימה לא הופיעה — מתעדים זאת כתוצאה תקינה של Best Effort, לא כבאג.
- **שינוי Configuration בלי קוד:** ב-Preview בלבד, `PERSONAL_DAILY_LIMIT=2` → Redeploy → אחרי 2 בדיחות מופיעה `נגמרו הבדיחות להיום!...` והכפתור מושבת → מחיקת המשתנה ו-Redeploy.
- **Circuit Breaker:** ב-Preview בלבד, `OPENAI_MODEL` לשם מודל לא קיים → Redeploy → 5 ניסיונות כושלים → הודעת `הקומיקאי לוקח הפסקה קצרה ☕...` ושורת `circuit_opened` בלוגים → החזרת `gpt-5` ו-Redeploy. (שם מודל לא קיים נדחה ע"י OpenAI ללא יצירה, כך שאין עלות.)
- שני השינויים האחרונים נעשים ע"י המשתמש ב-Vercel, בהדרכה, ורק לאחר אישורו. Rate Limiting ו-Config עולים מעט בדיחות אמיתיות (≈8).

### 5.4 Timeout וניטור
- ב-Vercel → Settings → Functions / Plan: לוודא שהתוכנית בפועל מאפשרת `maxDuration: 40` (נדרש ≥ 40, ADR-8). ב-Logs של בקשה רגילה — משך ההרצה (`latencyMs`) ביחס ל-28/40 שניות. לא מדמים Timeout אמיתי ב-Preview (נבדק בבדיקות האוטומטיות, Milestone 3).
- Vercel → Logs: שורות JSON של `joke_request` (קוד, `latencyMs`, `circuit`), ובדיקה שאין בהן נושא, בדיחה, Cookie או IP. תיעוד זמן שמירת הלוגים בתוכנית בפועל.

## 6. Production (אחרי אישור ה-Milestone ופקודת "פרסם לאוויר")

1. תנאים מקדימים: ה-Milestone ✅, CI ירוק על `develop`, אין שינויים שלא נדחפו, `OPENAI_API_KEY` של Production מוגדר. (אין Database ולכן אין Migrations.)
2. Claude מודיע שהדחיפה ל-`main` מפרסמת לציבור, וממתין לאישור.
3. מיזוג `develop` → `main` (Fast-forward) ו-Push של `main` → Production Deployment.
4. בדיקות חוזרות על הכתובת החיה: `/api/health`, Headers ו-HSTS, יצירת בדיחה, נושא ריק, Validation, יתרה, Offline, התקנת PWA בטלפון, פתיחה מחדש. **לא** מריצים שם את בדיקות שינוי ה-Config וה-Circuit Breaker.
5. דיווח למשתמש: הכתובת החיה, תוצאות ה-DoD, מגבלות Best Effort (מכסות, Rate Limiting ו-Circuit Breaker לכל Instance בנפרד; Replay של Cookie; הסוד המובנה, ADR-19), ושאין תקרת עלות ב-OpenAI. ואז עוצרים לאישור סופי.

## 7. מיפוי ל-Definition of Done

| תנאי | איך נבדק |
|---|---|
| Push ל-`develop` → Preview + CI עובר; רק `main` → Production | §5.1; דף Deployments ב-Vercel ו-Actions ב-GitHub |
| כל תרחישי הליבה נבדקו ב-Preview; אחרי פרסום גם ב-Production | §5.2, §6.4 |
| Secrets של Production רק ב-Vercel; אין מפתח ב-Frontend או ב-Repo | §3.5 ב-CI, §5.1, צילום מסך של רשימת המשתנים (בלי ערכים) |
| יצירה עובדת באתר החי; PWA ניתנת להתקנה; Offline זמין | §6.4 |
| Timeout ומשך Function תואמים לתוכנית Vercel | §5.4, ADR-24 |
| ניטור שגיאות וזמני תגובה | §5.4, ADR-24 |
| הוצגו מגבלות Best Effort ותוצאות בדיקות שמדגימות אותן | §5.3, §6.5 |
| עצירה לאישור סופי | §6.5 |

## 8. מחוץ לטווח

- אין דומיין מותאם אישית (נשארים בכתובת `*.vercel.app`), אין Analytics בתשלום, אין Firewall/Rate Limiting בתשלום של Vercel, אין Branch Protection ב-GitHub (דורש החלטת משתמש; המיזוג ל-`main` נעשה רק אחרי CI ירוק לפי הנוהל).
- אין בדיקות E2E אוטומטיות (Playwright וכד') — הבדיקות על ה-Preview ידניות/בדפדפן המובנה, לפי המילסטון.
- אין שינוי ב-UI, בהודעות או בלוגיקת המכסות.

## 9. תשובות המשתמש (22.10.2026)

1. ה-Vercel Project `jokesai` **כבר מחובר ל-GitHub** — §4.1 מצטמצם לבדיקה שהחיבור הוא ל-`tomerjbai-dev/jokesAI` ושענף ה-Production הוא `main`. סוג התוכנית (Hobby / Pro) ייבדק ב-Dashboard במהלך §5.4.
2. **אין מגבלת תקציב ב-OpenAI.** המרצה, בעל המפתח, אישר שימוש ללא הגבלה. PRD FR-03, MILESTONES ו-ARCHITECTURE (ADR-20) עודכנו בהתאם. המכסות הקיימות (20 אישיות, 100 כלליות, 5 בדקה, Best Effort) נשארות ההגנה היחידה על העלות.
3. **אותו מפתח OpenAI** ב-Preview וב-Production — מוגדר בשתי הסביבות ב-Vercel ומתועד ב-ADR-24 (חריגה מכוונת מההמלצה בהפרדת מפתחות, §2.10). המשמעות: בדיקות ב-Preview משתמשות באותו חשבון.
4. **אין `COOKIE_SIGNING_SECRET`** — נשאר הסוד המובנה (ADR-19). האתר זמני ויימחק בתום התרגול; יתועד ב-ADR-24.
