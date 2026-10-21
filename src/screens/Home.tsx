import { useState, type FormEvent } from 'react'

const MAX_TOPIC_LENGTH = 100

export default function Home() {
  const [topic, setTopic] = useState('')

  // Joke generation is wired up in Milestone 2; until then submitting does nothing.
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
  }

  return (
    <main className="screen">
      <span className="brush brush--corner" aria-hidden="true" />
      <span className="brush brush--bottom" aria-hidden="true" />
      <header className="brand-header">
        <h1 className="brand">בדיחומט</h1>
      </header>

      <div className="stack stack--center">
        <h2 className="title">על מה צוחקים היום? 😂</h2>
        <p className="body-text muted">כתבו נושא לבדיחה, או השאירו ריק ונפתיע אתכם.</p>
      </div>

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
            onChange={(event) => setTopic(event.target.value)}
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
        <button type="submit" className="btn btn--primary">
          צור בדיחה
        </button>
      </form>
    </main>
  )
}
