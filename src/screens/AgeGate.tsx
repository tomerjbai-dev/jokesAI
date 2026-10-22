type Props = {
  onConfirm: () => void
  onDecline: () => void
}

export default function AgeGate({ onConfirm, onDecline }: Props) {
  return (
    <main className="screen screen--age">
      <div className="age-hero" aria-hidden="true">
        <span className="brush brush--hero" />
        <div className="age-badge">18+</div>
      </div>

      <div className="stack stack--center">
        <h1 className="title">ברוכים הבאים לבדיחומט</h1>
        <p className="body-text">
          האפליקציה מיועדת למשתמשים בני 18 ומעלה וכוללת בדיחות בנושאים למבוגרים.
        </p>
        <p className="question">האם אתם מעל גיל 18?</p>
      </div>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          כן, אני מעל גיל 18
        </button>
        <button type="button" className="btn btn--secondary" onClick={onDecline}>
          לא, אני מתחת לגיל 18
        </button>
      </div>
    </main>
  )
}
