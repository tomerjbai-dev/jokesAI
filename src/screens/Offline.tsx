import { OFFLINE_MESSAGE } from '../messages.ts'

type Props = {
  onRetry: () => void
}

export default function Offline({ onRetry }: Props) {
  return (
    <main className="screen">
      <span className="brush brush--corner" aria-hidden="true" />
      <header className="brand-header">
        <h1 className="brand">בדיחומט</h1>
      </header>

      <div className="stack stack--center stack--spaced">
        <h2 className="title title--small" role="alert">
          {OFFLINE_MESSAGE}
        </h2>
      </div>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          נסו שוב
        </button>
      </div>
    </main>
  )
}
