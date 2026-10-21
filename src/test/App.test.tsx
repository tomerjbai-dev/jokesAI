import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import App from '../App.tsx'

const confirmLabel = 'כן, אני מעל גיל 18'
const declineLabel = 'לא, אני מתחת לגיל 18'

// No real network in tests: unless a test stubs fetch, every request (including /api/status) fails.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('no network in tests'))))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('age gate flow', () => {
  it('shows the age declaration on first visit', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'ברוכים הבאים לבדיחומט' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: declineLabel })).toBeInTheDocument()
    expect(screen.getByText('האם אתם מעל גיל 18?')).toBeInTheDocument()
  })

  it('confirming opens the home screen and persists consent', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: confirmLabel }))
    expect(screen.getByRole('heading', { name: 'על מה צוחקים היום? 😂' })).toBeInTheDocument()
    expect(localStorage.getItem('ageConfirmed')).toBe('true')
  })

  it('declining blocks access without persisting, and allows going back', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: declineLabel }))
    expect(screen.getByRole('heading', { name: 'אין גישה לאפליקציה' })).toBeInTheDocument()
    expect(localStorage.getItem('ageConfirmed')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'חזרה להצהרת הגיל' }))
    expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument()
  })

  it('skips the declaration when consent is already saved (refresh)', () => {
    localStorage.setItem('ageConfirmed', 'true')
    render(<App />)
    expect(screen.getByRole('heading', { name: 'בדיחומט' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: confirmLabel })).not.toBeInTheDocument()
  })

  it('shows the declaration again after browser data is cleared', () => {
    localStorage.setItem('ageConfirmed', 'true')
    const { unmount } = render(<App />)
    unmount()
    localStorage.clear()
    render(<App />)
    expect(screen.getByRole('button', { name: confirmLabel })).toBeInTheDocument()
  })
})

describe('home screen', () => {
  const renderHome = () => {
    localStorage.setItem('ageConfirmed', 'true')
    render(<App />)
  }

  it('has the approved structure only', () => {
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: 'בדיחומט' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'על מה צוחקים היום? 😂' })).toBeInTheDocument()
    const topicField = screen.getByLabelText('נושא לבדיחה')
    expect(topicField).toHaveAttribute('maxLength', '100')
    expect(topicField).toHaveAttribute('placeholder', 'כתבו נושא לבדיחה...')
    expect(screen.getByText('כתבו נושא לבדיחה, או השאירו ריק ונפתיע אתכם.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'צור בדיחה' })).toBeInTheDocument()

    // Only the create button exists: no menu, history, copy, like or separate quota screen.
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('hides the balance line when the status is unavailable, and still allows creating', async () => {
    renderHome()
    await act(async () => {})
    expect(screen.queryByText(/נשאר/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'צור בדיחה' })).toBeEnabled()
  })

  it('updates the character counter while typing', async () => {
    renderHome()
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), 'חתולים')
    expect(screen.getByText('6/100')).toBeInTheDocument()
  })

})

describe('joke generation', () => {
  type Reply = { status: number; body: unknown }

  // Each joke request returns a promise we resolve by hand, so loading states can be inspected.
  // GET /api/status answers right away with `status` (a failed status hides the balance line).
  const mockFetch = (status: Reply = { status: 404, body: {} }) => {
    const pending: ((reply: Reply) => void)[] = []
    const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
      url === '/api/status'
        ? Promise.resolve(new Response(JSON.stringify(status.body), { status: status.status }))
        : new Promise<Response>((resolve) => {
            pending.push(({ status, body }) => resolve(new Response(JSON.stringify(body), { status })))
          }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const respond = async (reply: Reply) => {
      await act(async () => pending.shift()?.(reply))
    }
    const jokeCalls = () => fetchMock.mock.calls.filter(([url]) => url === '/api/jokes')
    const init = (call: number) => jokeCalls()[call][1] as RequestInit
    const sentBody = (call: number) => JSON.parse(init(call).body as string)
    return { fetchMock, respond, sentBody, init, jokeCount: () => jokeCalls().length }
  }

  const renderHome = () => {
    localStorage.setItem('ageConfirmed', 'true')
    render(<App />)
    return {
      field: () => screen.getByLabelText('נושא לבדיחה'),
      button: () => screen.getByRole('button'),
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the joke above the field, hides the intro and keeps the topic', async () => {
    const { fetchMock, respond, sentBody } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), 'חתולים')
    await userEvent.click(ui.button())

    expect(fetchMock).toHaveBeenCalledWith('/api/jokes', expect.objectContaining({ method: 'POST' }))
    expect(sentBody(0)).toEqual({ topic: 'חתולים' })
    await respond({ status: 200, body: { joke: 'בדיחה על חתולים' } })

    const card = screen.getByText('בדיחה על חתולים')
    expect(card).toBeInTheDocument()
    expect(card.compareDocumentPosition(ui.field()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'על מה צוחקים היום? 😂' })).not.toBeInTheDocument()
    expect(ui.button()).toHaveTextContent('בדיחה חדשה')
    expect(ui.field()).toHaveValue('חתולים')
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('Enter triggers the same request as the button', async () => {
    const { sentBody, jokeCount } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), 'כלבים{Enter}')
    expect(jokeCount()).toBe(1)
    expect(sentBody(0)).toEqual({ topic: 'כלבים' })
  })

  it('locks the form while loading and ignores repeated submits', async () => {
    const { respond, jokeCount } = mockFetch()
    const ui = renderHome()
    await userEvent.click(ui.button())

    expect(screen.getByRole('status')).toHaveTextContent('ממציאים לכם בדיחה...')
    expect(ui.field()).toBeDisabled()
    expect(ui.button()).toBeDisabled()
    await userEvent.click(ui.button())
    fireEvent.submit(ui.field().closest('form')!)
    expect(jokeCount()).toBe(1)

    await respond({ status: 200, body: { joke: 'בדיחה' } })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(ui.field()).toBeEnabled()
  })

  it('sends an empty topic for a general joke', async () => {
    const { sentBody } = mockFetch()
    const ui = renderHome()
    await userEvent.click(ui.button())
    expect(sentBody(0)).toEqual({ topic: '' })
  })

  it('keeps the previous joke while loading, sends it, and replaces it only on success', async () => {
    const { respond, sentBody } = mockFetch()
    const ui = renderHome()
    await userEvent.click(ui.button())
    await respond({ status: 200, body: { joke: 'בדיחה ראשונה' } })

    await userEvent.click(ui.button())
    expect(sentBody(1)).toEqual({ topic: '', previousJoke: 'בדיחה ראשונה' })
    expect(screen.getByText('בדיחה ראשונה')).toBeInTheDocument()

    await respond({ status: 200, body: { joke: 'בדיחה שנייה' } })
    expect(screen.getByText('בדיחה שנייה')).toBeInTheDocument()
    expect(screen.queryByText('בדיחה ראשונה')).not.toBeInTheDocument()
  })

  it('blocks whitespace-only input without calling the API', async () => {
    const { jokeCount } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), '   ')
    await userEvent.click(ui.button())
    expect(screen.getByRole('alert')).toHaveTextContent('רווחים זה נחמד, אבל תנו לנו נושא אמיתי 😅')
    expect(jokeCount()).toBe(0)

    await userEvent.type(ui.field(), 'א')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['a service failure', { status: 500, body: { code: 'INTERNAL_ERROR', message: 'x' } }, 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'],
    ['a timeout', { status: 504, body: { code: 'AI_TIMEOUT', message: 'x' } }, 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'],
    ['a refusal', { status: 422, body: { code: 'UNSUPPORTED_TOPIC', message: 'x' } }, 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!'],
  ])('on %s keeps the joke and topic, shows the message and retries only manually', async (_label, failure, text) => {
    const { respond, jokeCount } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), 'ים')
    await userEvent.click(ui.button())
    await respond({ status: 200, body: { joke: 'בדיחה על הים' } })

    await userEvent.click(ui.button())
    await respond(failure)
    expect(screen.getByRole('alert')).toHaveTextContent(text)
    expect(screen.getByText('בדיחה על הים')).toBeInTheDocument()
    expect(ui.field()).toHaveValue('ים')
    expect(ui.button()).toBeEnabled()
    expect(jokeCount()).toBe(2)

    await userEvent.click(ui.button())
    expect(jokeCount()).toBe(3)
    await respond({ status: 200, body: { joke: 'בדיחה חדשה על הים' } })
    expect(screen.getByText('בדיחה חדשה על הים')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows "connection dropped" on the home screen when a request fails while online', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    const ui = renderHome()
    await userEvent.click(ui.button())
    expect(await screen.findByRole('alert')).toHaveTextContent('החיבור נקטע באמצע הבדיחה 📡 אפשר לנסות שוב.')
    expect(screen.queryByText('אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.')).not.toBeInTheDocument()
    expect(ui.field()).toBeVisible()
  })

  it('tries to cancel the active request when the page is hidden (refresh/close)', async () => {
    const { init } = mockFetch()
    const ui = renderHome()
    await userEvent.click(ui.button())
    expect(init(0).signal?.aborted).toBe(false)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(init(0).signal?.aborted).toBe(true)
  })

  describe('daily balance and limits', () => {
    const okStatus = (body: Record<string, unknown> = {}) => ({
      status: 200,
      body: { remainingToday: 20, dailyLimit: 20, globalAvailableEstimate: true, ...body },
    })
    const personalText = 'נגמרו הבדיחות להיום! חזרו מחר לעוד צחוקים 😄'
    const globalText = 'הקומיקאי שלנו סיים להיום 🎤😴 נגמרו הבדיחות, נתראה מחר!'
    const rateText = 'רגע, גם לקומיקאי מגיע לנשום 😅'

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows the balance under the button and updates it after a success', async () => {
      const { respond } = mockFetch(okStatus())
      const ui = renderHome()
      const line = await screen.findByText('נשארו 20 בדיחות היום')
      expect(ui.button().compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

      await userEvent.click(ui.button())
      await respond({ status: 200, body: { joke: 'בדיחה', remainingToday: 19 } })
      expect(screen.getByText('נשארו 19 בדיחות היום')).toBeInTheDocument()
    })

    it('uses the singular for the last joke, then shows the quota message and disables the button', async () => {
      const { respond, jokeCount } = mockFetch(okStatus({ remainingToday: 1 }))
      const ui = renderHome()
      expect(await screen.findByText('נשארה בדיחה אחת היום')).toBeInTheDocument()

      await userEvent.click(ui.button())
      await respond({ status: 200, body: { joke: 'בדיחה אחרונה', remainingToday: 0 } })
      expect(screen.getByRole('alert')).toHaveTextContent(personalText)
      expect(ui.button()).toBeDisabled()
      expect(screen.getByText('בדיחה אחרונה')).toBeInTheDocument()

      fireEvent.submit(ui.field().closest('form')!)
      expect(jokeCount()).toBe(1)
    })

    it.each([
      ['PERSONAL_QUOTA_EXCEEDED', personalText],
      ['GLOBAL_QUOTA_EXCEEDED', globalText],
    ])('on 429 %s shows the message, keeps the joke and disables creating', async (code, text) => {
      const { respond, jokeCount } = mockFetch(okStatus({ remainingToday: 5 }))
      const ui = renderHome()
      await userEvent.click(ui.button())
      await respond({ status: 200, body: { joke: 'בדיחה', remainingToday: 4 } })
      await userEvent.click(ui.button())
      await respond({ status: 429, body: { code, message: 'x' } })

      expect(screen.getByRole('alert')).toHaveTextContent(text)
      expect(screen.getByText('בדיחה')).toBeInTheDocument()
      expect(ui.button()).toBeDisabled()
      await userEvent.type(ui.field(), '{Enter}')
      expect(jokeCount()).toBe(2)
    })

    it('on 429 RATE_LIMITED counts down, then enables the button again', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
      const { respond, jokeCount } = mockFetch(okStatus())
      const ui = renderHome()
      fireEvent.submit(ui.field().closest('form')!)
      await respond({ status: 429, body: { code: 'RATE_LIMITED', message: 'x', retryAfterSeconds: 3 } })

      expect(screen.getByRole('alert')).toHaveTextContent(rateText)
      expect(screen.getByText('אפשר לנסות שוב בעוד 3 שניות')).toBeInTheDocument()
      expect(ui.button()).toBeDisabled()
      fireEvent.submit(ui.field().closest('form')!)
      expect(jokeCount()).toBe(1)

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText('אפשר לנסות שוב בעוד 2 שניות')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText('אפשר לנסות שוב בעוד שנייה')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1000))
      expect(screen.queryByText(rateText)).not.toBeInTheDocument()
      expect(ui.button()).toBeEnabled()
    })

    it('keeps the button active when the service is paused (503)', async () => {
      const { respond } = mockFetch(okStatus())
      const ui = renderHome()
      await userEvent.click(ui.button())
      await respond({ status: 503, body: { code: 'AI_UNAVAILABLE', message: 'x' } })
      expect(screen.getByRole('alert')).toHaveTextContent('הקומיקאי לוקח הפסקה קצרה ☕ אפשר לנסות שוב בעוד כמה דקות.')
      expect(ui.button()).toBeEnabled()
    })

    it.each([
      ['an exhausted personal quota', { remainingToday: 0 }, personalText],
      ['an exhausted global quota', { globalAvailableEstimate: false }, globalText],
      ['an active rate limit', { retryAfterSeconds: 30 }, rateText],
    ])('applies %s reported on load', async (_label, status, text) => {
      mockFetch(okStatus(status))
      const ui = renderHome()
      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      expect(ui.button()).toBeDisabled()
    })

    it('checks the status again when the app is shown, clearing a limit that ended', async () => {
      let status = okStatus({ remainingToday: 0 })
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(status.body), { status: 200 })),
      )
      const ui = renderHome()
      expect(await screen.findByRole('alert')).toHaveTextContent(personalText)

      status = okStatus()
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(ui.button()).toBeEnabled()
      expect(screen.getByText('נשארו 20 בדיחות היום')).toBeInTheDocument()
    })
  })
})

describe('offline screen', () => {
  const offlineText = 'אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.'
  let online = true

  const setNetwork = (value: boolean) => {
    online = value
    act(() => {
      window.dispatchEvent(new Event(value ? 'online' : 'offline'))
    })
  }

  beforeEach(() => {
    online = true
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('appears when the device goes offline and returns with the same topic and joke', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ joke: 'בדיחה על ים' }), { status: 200 })))
    localStorage.setItem('ageConfirmed', 'true')
    render(<App />)
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), 'ים')
    await userEvent.click(screen.getByRole('button'))
    expect(await screen.findByText('בדיחה על ים')).toBeInTheDocument()

    setNetwork(false)
    expect(screen.getByText(offlineText)).toBeInTheDocument()
    expect(screen.getByLabelText('נושא לבדיחה')).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'נסו שוב' })).toBeInTheDocument()

    setNetwork(true)
    expect(screen.queryByText(offlineText)).not.toBeInTheDocument()
    expect(screen.getByText('בדיחה על ים')).toBeVisible()
    expect(screen.getByLabelText('נושא לבדיחה')).toHaveValue('ים')
  })

  it('"try again" stays offline without a network and returns once it is back', async () => {
    online = false
    localStorage.setItem('ageConfirmed', 'true')
    render(<App />)
    expect(screen.getByText(offlineText)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'נסו שוב' }))
    expect(screen.getByText(offlineText)).toBeInTheDocument()

    online = true
    await userEvent.click(screen.getByRole('button', { name: 'נסו שוב' }))
    expect(screen.queryByText(offlineText)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'על מה צוחקים היום? 😂' })).toBeVisible()
  })

  it('also covers the age declaration', () => {
    online = false
    render(<App />)
    expect(screen.getByText(offlineText)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'כן, אני מעל גיל 18', hidden: true })).not.toBeVisible()
  })
})

describe('document setup', () => {
  it('is Hebrew, right-to-left and titled בדיחומט', () => {
    expect(indexHtml).toContain('<html lang="he" dir="rtl">')
    expect(indexHtml).toContain('<title>בדיחומט</title>')
  })
})
