import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_TOPIC_LENGTH, validateTopic, WHITESPACE_TOPIC_MESSAGE } from '../../shared/topic.ts'
import { fetchStatus, requestJoke, type Block, type Status } from '../jokesApi.ts'
import {
  countdownText,
  GLOBAL_QUOTA_MESSAGE,
  PERSONAL_QUOTA_MESSAGE,
  RATE_LIMIT_MESSAGE,
  remainingText,
} from '../messages.ts'
import SadClown from './SadClown.tsx'

type Message = { kind: 'input' | 'error'; text: string }

// While a limit is active the create button stays disabled; a rate limit clears itself at `until`.
type ActiveBlock = { kind: 'personal' } | { kind: 'global' } | { kind: 'rate'; until: number }

const toActive = (block: Block): ActiveBlock =>
  block.kind === 'rate' ? { kind: 'rate', until: Date.now() + block.retryAfterSeconds * 1000 } : block

function blockFromStatus(status: Status): ActiveBlock | null {
  if (status.remainingToday === 0) return { kind: 'personal' }
  if (!status.globalAvailableEstimate) return { kind: 'global' }
  if (status.retryAfterSeconds) return toActive({ kind: 'rate', retryAfterSeconds: status.retryAfterSeconds })
  return null
}

export default function Home() {
  const [topic, setTopic] = useState('')
  const [joke, setJoke] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  // null while the balance is unknown (status not loaded or unavailable): the line is hidden.
  const [remaining, setRemaining] = useState<number | null>(null)
  const [block, setBlock] = useState<ActiveBlock | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // State updates are async, so a ref blocks a second submit fired in the same tick.
  const inFlight = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)

  // The balance and any active limit come from the server on load and whenever the app is shown again,
  // so a limit that ended (e.g. after midnight) clears without a manual refresh.
  const refreshStatus = useCallback(async () => {
    const status = await fetchStatus()
    if (!status) return
    setRemaining(status.remainingToday)
    setBlock(blockFromStatus(status))
  }, [])

  useEffect(() => {
    void refreshStatus()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshStatus()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refreshStatus])

  // Countdown tick, only while rate limited.
  const rateUntil = block?.kind === 'rate' ? block.until : null
  useEffect(() => {
    if (rateUntil === null) return
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= rateUntil) setBlock(null)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [rateUntil])

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
    if (inFlight.current || block) return

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
    if (result.ok) {
      setJoke(result.joke)
      if (result.remainingToday !== undefined) {
        setRemaining(result.remainingToday)
        // The last joke of the day: show the quota message right away.
        if (result.remainingToday === 0) setBlock({ kind: 'personal' })
      }
    } else if ('block' in result && result.block) {
      // The limit message replaces the error line.
      setBlock(toActive(result.block))
      if (result.block.kind === 'personal') setRemaining(0)
    } else if ('message' in result) setMessage({ kind: 'error', text: result.message })
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
      {message?.kind === 'error' && !block && (
        <p className="message" role="alert">
          {message.text}
        </p>
      )}
      {block?.kind === 'personal' && (
        <p className="message" role="alert">
          {PERSONAL_QUOTA_MESSAGE}
        </p>
      )}
      {block?.kind === 'global' && (
        <p className="message" role="alert">
          {GLOBAL_QUOTA_MESSAGE}
        </p>
      )}
      {block?.kind === 'rate' && (
        <div className="message" role="alert">
          <p>{RATE_LIMIT_MESSAGE}</p>
          <p className="countdown" aria-live="polite">
            {countdownText(Math.max(1, Math.ceil((block.until - now) / 1000)))}
          </p>
        </div>
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
        <button type="submit" className="btn btn--primary" disabled={loading || block !== null}>
          {joke === null ? 'צור בדיחה' : 'בדיחה חדשה'}
        </button>
        {remaining !== null && remaining > 0 && block?.kind !== 'global' && (
          <p className="remaining">{remainingText(remaining)}</p>
        )}
      </form>

      <SadClown />
    </main>
  )
}
