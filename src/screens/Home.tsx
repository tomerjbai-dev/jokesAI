import { useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_TOPIC_LENGTH, validateTopic, WHITESPACE_TOPIC_MESSAGE } from '../../shared/topic.ts'
import { requestJoke } from '../jokesApi.ts'

type Message = { kind: 'input' | 'error'; text: string }

export default function Home() {
  const [topic, setTopic] = useState('')
  const [joke, setJoke] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  // State updates are async, so a ref blocks a second submit fired in the same tick.
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)

  // Best-effort cancel of an active request on refresh, close, navigation away or unmount.
  useEffect(() => {
    const cancel = () => activeRequest.current?.abort()
    window.addEventListener('pagehide', cancel)
    return () => {
      window.removeEventListener('pagehide', cancel)
      cancel()
    }
  }, [])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return

    const check = validateTopic(topic)
    if (!check.ok) {
      if (check.reason === 'whitespace') setMessage({ kind: 'input', text: WHITESPACE_TOPIC_MESSAGE })
      return
    }

    inFlight.current = true
    setLoading(true)
    setMessage(null)
    const controller = new AbortController()
    activeRequest.current = controller
    const result = await requestJoke(topic.trim(), joke ?? undefined, controller.signal)
    activeRequest.current = null
    // The previous joke stays on screen until a new one arrives; there is no automatic retry.
    if (result.ok) setJoke(result.joke)
    else if ('message' in result) setMessage({ kind: 'error', text: result.message })
    setLoading(false)
    inFlight.current = false
  }

  return (
    <main className="screen">
      <span className="brush brush--corner" aria-hidden="true" />
      <span className="brush brush--bottom" aria-hidden="true" />
      <header className="brand-header">
        <h1 className="brand">בדיחומט</h1>
      </header>

      {joke === null ? (
        <div className="stack stack--center">
          <h2 className="title">על מה צוחקים היום? 😂</h2>
          <p className="body-text muted">כתבו נושא לבדיחה, או השאירו ריק ונפתיע אתכם.</p>
        </div>
      ) : (
        <article className="joke-card" aria-live="polite">
          <p className="joke-card__text">{joke}</p>
        </article>
      )}

      {loading && (
        <p className="status-line" role="status">
          <span className="status-line__icon" aria-hidden="true">
            🎤
          </span>
          ממציאים לכם בדיחה...
        </p>
      )}
      {message?.kind === 'error' && (
        <p className="message" role="alert">
          {message.text}
        </p>
      )}

      <form className="topic-form" onSubmit={handleSubmit}>
        <label htmlFor="topic" className="visually-hidden">
          נושא לבדיחה
        </label>
        <div className="field">
          <textarea
            id="topic"
            className="field__input"
            placeholder="כתבו נושא לבדיחה..."
            maxLength={MAX_TOPIC_LENGTH}
            rows={4}
            value={topic}
            disabled={loading}
            onChange={(event) => {
              setTopic(event.target.value)
              if (message?.kind === 'input') setMessage(null)
            }}
            onKeyDown={(event) => {
              // Enter submits; Shift+Enter keeps a newline.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            enterKeyHint="send"
          />
          <span className="field__counter" dir="ltr" aria-live="polite">
            {topic.length}/{MAX_TOPIC_LENGTH}
          </span>
        </div>
        {message?.kind === 'input' && (
          <p className="message" role="alert">
            {message.text}
          </p>
        )}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {joke === null ? 'צור בדיחה' : 'בדיחה חדשה'}
        </button>
      </form>
    </main>
  )
}
