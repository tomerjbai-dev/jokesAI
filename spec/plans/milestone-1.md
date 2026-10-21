# תוכנית — Milestone 1: בסיס אפליקציה וכניסה מותנית בגיל

**מקורות:** `PRD.md` (FR-02, FR-06 שם האפליקציה, UX Requirements), `ARCHITECTURE.md` (§1, §2.8), `DESIGN.md` (§1.1, §1.2, §1.4, §1.7, §2), `MILESTONES.md` (Milestone 1).

## 1. היקף

**בתוך ה-Milestone:**
- פרויקט React + TypeScript + Vite בשורש הריפו, עברית ו-RTL, גופן Heebo, CSS Variables לפי `DESIGN.md`.
- מסך הצהרת גיל 18+, מסך חסימת גישה, מסך ראשי (פתיחה) — ללא יצירת בדיחה.
- שמירת אישור הגיל ב-Local Storage.
- בדיקות אוטומטיות (Vitest + Testing Library) ו-Build תקין.
- מילוי "פקודות הרצה" ב-`CLAUDE.md`.

**מחוץ ל-Milestone (לא לממש עכשיו):**
- Backend / תיקיית `api/`, OpenAI, `.env` — Milestone 2. אין צורך בסודות בשלב זה, ולכן לא נוצר `.env.example`.
- יצירת בדיחה, כרטיס בדיחה, מצבי טעינה/שגיאה — Milestone 2–3.
- שורת היתרה היומית (`נשארו 20 בדיחות היום`) — Milestone 4. אין להציג מספר מומצא לפני שהמכסה אמיתית.
- PWA, Manifest, Service Worker, מסך Offline — Milestone 3.
- תפריט Hamburger, היסטוריה, מכסות, מידע על האפליקציה, העתקה/לייק — לא ב-MVP כלל (מופיעים בתמונות בלבד).
- חיבור ל-GitHub ו-push — רק בשלב "דחיפה", לפי בקשה.

## 2. מבנה קבצים

```text
/
├── index.html                 # lang="he" dir="rtl", <title>בדיחומט</title>, theme-color, viewport
├── package.json               # scripts: dev, build, preview, test
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts             # React plugin + הגדרות Vitest (environment: jsdom)
├── public/
│   └── favicon.svg            # אייקון פשוט: עיגול אדום עם "18+" או אות ב'
└── src/
    ├── main.tsx               # טעינת גופן Heebo ו-styles, רינדור App
    ├── App.tsx                # בורר מסכים לפי מצב (ללא Router)
    ├── ageConsent.ts          # קריאה/כתיבה של אישור גיל ב-Local Storage
    ├── screens/
    │   ├── AgeGate.tsx        # הצהרת 18+
    │   ├── AccessDenied.tsx   # חסימת גישה
    │   └── Home.tsx           # מסך ראשי
    ├── styles/
    │   ├── tokens.css         # CSS Variables: צבעים, טיפוגרפיה, ריווח, רדיוס, צל
    │   └── global.css         # reset, body, כפתורים, שדה, מבנה עמודה, דקורציה
    └── test/
        ├── setup.ts           # jest-dom matchers + ניקוי localStorage בין בדיקות
        └── App.test.tsx       # בדיקות זרימת גיל ומבנה מסכים
```

## 3. תלויות

- Runtime: `react`, `react-dom`, `@fontsource/heebo` (משקלים 400/500/700).
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`.
- יצירת הפרויקט: `npm create vite@latest` עם תבנית `react-ts` לתיקייה זמנית ומיזוג לשורש (בלי לדרוס את `.gitignore`, `CLAUDE.md` ו-`spec/`), או כתיבה ידנית של אותם קבצים. מחיקת קובצי הדוגמה של התבנית (לוגו Vite, מונה וכו').
- Node 24 קיים במחשב.

**למה הגופן מותקן מקומית (`@fontsource`) ולא מ-Google Fonts:** בהמשך (Milestone 3) מסך ה-Offline צריך לעבוד בלי רשת; גופן שנארז עם האפליקציה יעבוד גם אז, ולא נשלחת בקשה לשרת חיצוני.

## 4. ניהול מצב וזרימה

- `ageConsent.ts`:
  - מפתח Local Storage: `ageConfirmed`, ערך `"true"`.
  - `hasAgeConsent(): boolean`, `saveAgeConsent(): void`.
  - עטיפה ב-`try/catch` — אם Local Storage חסום, מתנהגים כאילו אין אישור (ההצהרה תוצג שוב), בלי קריסה.
- `App.tsx` מחזיק `screen: 'age-gate' | 'denied' | 'home'`; ערך התחלתי: `'home'` אם יש אישור שמור, אחרת `'age-gate'`.
  - "כן, אני בן 18 ומעלה" → `saveAgeConsent()` → `'home'`.
  - "לא, אני מתחת לגיל 18" → `'denied'`. **אי-האישור לא נשמר** — רענון מחזיר להצהרה (PRD: חסימה עם אפשרות לחזור להצהרה).
  - "חזרה להצהרת הגיל" → `'age-gate'`.
- אין React Router: יש שלושה מסכים פשוטים, אין כתובות שצריך לשתף, ו-ARCHITECTURE מגדיר SPA ללא ניתובים. יתועד כ-ADR.
- רענון לאחר אישור → מסך ראשי עם שדה ריק (אין מה לשחזר ב-M1).

## 5. מסכים ותוכן

כל הטקסטים בעברית, מיושרים ל-RTL. נוסחים מה-Wireframes/Mockups, אלא אם צוין אחרת.

### 5.1 הצהרת גיל (`AgeGate`)
- אזור עליון צהוב עם דקורציית "משיכות מכחול" (CSS בלבד) ותג עגול גדול `18+` עם מסגרת אדומה.
- כותרת H2: `ברוכים הבאים לבדיחומט`.
- טקסט: `האפליקציה מיועדת למשתמשים בני 18 ומעלה וכוללת בדיחות בנושאים למבוגרים.`
- שאלה מודגשת: `האם אתה בן 18 ומעלה?`
- כפתור Primary (אדום מלא): `כן, אני בן 18 ומעלה`.
- כפתור Secondary (בהיר עם קו מתאר): `לא, אני מתחת לגיל 18`.

### 5.2 חסימת גישה (`AccessDenied`)
- כותרת מותג `בדיחומט` בראש המסך.
- סמל חסימה (SVG פנימי, עיגול עם קו אלכסוני) באדום.
- כותרת: `אין גישה לאפליקציה`.
- טקסט: `האפליקציה מיועדת למשתמשים בני 18 ומעלה.` ו-`יש לאשר את הצהרת הגיל כדי להשתמש באפליקציה.`
- כפתור Primary רחב: `חזרה להצהרת הגיל`.

### 5.3 מסך ראשי (`Home`)
- כותרת מותג H1 `בדיחומט` באדום, ממורכזת (לפי ה-Mockup). **ללא** אייקון Hamburger.
- כותרת H2: `על מה צוחקים היום? 😂`.
- הנחיה קצרה (נוסח מוצע, PRD מתיר ניסוח חופשי): `כתבו נושא לבדיחה, או השאירו ריק ונפתיע אתכם.`
- `<textarea>` גדול ומעוגל, Placeholder `כתוב נושא לבדיחה...`, `maxLength={100}`, מונה תווים `0/100` בפינה התחתונה, `<label>` נגיש (מוסתר ויזואלית).
- כפתור Primary `צור בדיחה`.
- **התנהגות ב-M1:** הכפתור מוצג אך לא מחובר לשום פעולה — לחיצה או Enter לא מציגים תוצאה, טעינה או הודעה כלשהי (MILESTONES: אין להציג תוצאה מדומה). החיבור האמיתי ב-Milestone 2.
- אין שורת יתרה יומית בשלב זה (ראה §1).

## 6. עיצוב (`tokens.css`, `global.css`)

- **צבעים** (CSS Variables): `--primary-yellow #FFF10A`, `--secondary-yellow #FEC208`, `--primary-red #CF240A`, `--secondary-red #FF2D08`, `--dark #1F1F1F`, `--background #FAF9F6`, `--surface #EDE7DD`, `--text-secondary #6B6B6B` (גווני Accent מוגדרים אך כמעט לא בשימוש).
- **טיפוגרפיה:** `font-family: 'Heebo', system-ui, sans-serif`; H1 32/700, H2 24/700, H3 20/700, Body 16/400, Caption 14/400.
- **ריווח:** `--space-1: 8px`, `--space-2: 16px`, `--space-3: 24px`.
- **רדיוס:** `--radius: 16px` לכפתורים, שדה וכרטיסים.
- **צל:** `--shadow: 0 4px 16px rgba(0,0,0,0.08)`.
- **כפתורים:** Primary — רקע `--primary-red`, טקסט לבן 700, גובה מינימלי 52px, רוחב מלא. Secondary — רקע לבן/קרם, Border דק אפור, טקסט כהה. Focus גלוי (`outline` ברור), `:active` עם הקטנה עדינה.
- **שדה:** רקע לבן, Border אפור עדין, רדיוס 16px, Placeholder ב-`--text-secondary`, Focus עם מסגרת אדומה.
- **פריסה:** עמודה אחת, `max-width: 480px` ממורכזת, שוליים צדדיים 16–24px, `min-height: 100dvh`, ללא גלילה אופקית.
- **רקע:** קרם `--background`; משיכות מכחול צהובות/אדומות בפינות באמצעות `linear-gradient`/`clip-path` ב-CSS, בעוצמה עדינה שלא פוגעת בקריאות.
- **תנועה:** מעבר רך בין מסכים (fade קצר); כיבוד `prefers-reduced-motion`.
- **תמונת הליצן מה-Mockups — לא נכללת.** DESIGN §2.4 מתנה שימוש בתמונות בזכויות שימוש ובקיום נכסים; אין לנו קובץ מורשה. במקומה: אזור צהוב עם תג `18+` ודקורציית מכחול. אם תספק תמונה מורשית — נוסיף אותה בקלות.
- גימור עיצובי מלא (טקסטורת נייר, אייקונים נוספים) — Milestone 5.

## 7. בדיקות

`src/test/App.test.tsx` (Vitest + jsdom + Testing Library):
1. ביקור ראשון (Local Storage ריק) → מוצגת הצהרת גיל עם שני הכפתורים.
2. לחיצה על "כן" → מסך ראשי מוצג, ו-`localStorage.ageConfirmed === "true"`.
3. לחיצה על "לא" → מסך חסימה; לא נשמר אישור; "חזרה להצהרת הגיל" מחזיר להצהרה.
4. רינדור מחדש עם אישור שמור (מדמה רענון) → מסך ראשי ישירות, בלי הצהרה.
5. ניקוי Local Storage ורינדור מחדש (מדמה מחיקת נתוני דפדפן) → הצהרה מוצגת שוב.
6. מבנה המסך הראשי: `בדיחומט`, `על מה צוחקים היום? 😂`, שדה עם `maxLength=100`, כפתור `צור בדיחה`; **אין** כפתור תפריט, היסטוריה, העתקה, לייק או שורת יתרה.
7. מונה התווים מתעדכן בהקלדה (`5/100`).
8. לחיצה על `צור בדיחה` לא מציגה בדיחה או הודעה.
9. `document.documentElement` עם `dir="rtl"` ו-`lang="he"` (בדיקה על `index.html` או ב-setup).

## 8. אימות ידני בזמן הבנייה

- `npm run build` (כולל `tsc -b`) ו-`npm test` — ללא שגיאות.
- `npm run dev`, פתיחה בדפדפן המובנה ב-Viewport מובייל (375px): מעבר על שלוש הזרימות, רענון אחרי אישור, ניקוי Local Storage, בדיקה שאין גלילה אופקית, צילום מסך להשוואה מול ה-Mockups.
- סגירת שרת הפיתוח בסיום.

## 9. עדכוני מסמכים בסיום הבנייה

- `CLAUDE.md` → "פקודות הרצה": `npm run dev` / `npm test`.
- `ARCHITECTURE.md` → סעיף `## החלטות מרכזיות (ADRs)` (חדש):
  - ADR-1: ניווט מבוסס מצב (State) ללא Router.
  - ADR-2: גופן Heebo נארז עם האפליקציה (`@fontsource/heebo`).
  - ADR-3: Vitest + Testing Library ככלי הבדיקות.
- `MILESTONES.md` → 🟡 ליד כותרת Milestone 1.

## 10. מיפוי ל-Definition of Done

| תנאי | איך מכוסה |
|---|---|
| `npm run build` ובדיקות עוברים ללא שגיאות TypeScript | §7, §8 |
| ביקור ראשון → הצהרה; אישור → כניסה; אי-אישור → חסימה וחזרה | §4, בדיקות 1–3 |
| רענון אחרי אישור לא דורש אישור; מחיקת נתונים מחזירה הצהרה | §4, בדיקות 4–5, אימות ידני |
| עברית, RTL, Mobile First, צבעים/טיפוגרפיה/רכיבים לפי DESIGN | §5, §6, בדיקה 9, צילום מסך |
| אין מסכים או פעולות שלא אושרו | §1, בדיקות 6 ו-8 |
