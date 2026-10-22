type Props = {
  onBack: () => void
}

export default function AccessDenied({ onBack }: Props) {
  return (
    <main className="screen">
      <span className="brush brush--corner" aria-hidden="true" />
      <header className="brand-header">
        <h1 className="brand">בדיחומט</h1>
      </header>

      <div className="stack stack--center stack--spaced">
        <svg className="blocked-icon" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
          <line x1="14" y1="14" x2="50" y2="50" stroke="currentColor" strokeWidth="6" />
        </svg>
        <h2 className="title">אין גישה לאפליקציה</h2>
        <p className="body-text">האפליקציה מיועדת למשתמשים בני 18 ומעלה.</p>
        <p className="body-text">יש לאשר את הצהרת הגיל כדי להשתמש באפליקציה.</p>
      </div>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onBack}>
          חזרה להצהרת הגיל
        </button>
      </div>
    </main>
  )
}
