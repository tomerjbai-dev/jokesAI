import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import App from '../App.tsx'

const confirmLabel = 'כן, אני מעל גיל 18'
const declineLabel = 'לא, אני מתחת לגיל 18'

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

    // Only the create button exists: no menu, history, copy, like or quota UI.
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByText(/נשארו/)).not.toBeInTheDocument()
  })

  it('updates the character counter while typing', async () => {
    renderHome()
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), 'חתולים')
    expect(screen.getByText('6/100')).toBeInTheDocument()
  })

})

describe('joke generation', () => {
  type Reply = { status: number; body: unknown }

  // Each call to fetch returns a promise we resolve by hand, so loading states can be inspected.
  const mockFetch = () => {
    const pending: ((reply: Reply) => void)[] = []
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          pending.push(({ status, body }) => resolve(new Response(JSON.stringify(body), { status })))
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const respond = async (reply: Reply) => {
      await act(async () => pending.shift()?.(reply))
    }
    const init = (call: number) => (fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1]
    const sentBody = (call: number) => JSON.parse(init(call).body as string)
    return { fetchMock, respond, sentBody, init }
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
    const { fetchMock, sentBody } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), 'כלבים{Enter}')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentBody(0)).toEqual({ topic: 'כלבים' })
  })

  it('locks the form while loading and ignores repeated submits', async () => {
    const { fetchMock, respond } = mockFetch()
    const ui = renderHome()
    await userEvent.click(ui.button())

    expect(screen.getByRole('status')).toHaveTextContent('ממציאים לכם בדיחה...')
    expect(ui.field()).toBeDisabled()
    expect(ui.button()).toBeDisabled()
    await userEvent.click(ui.button())
    fireEvent.submit(ui.field().closest('form')!)
    expect(fetchMock).toHaveBeenCalledTimes(1)

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
    const { fetchMock } = mockFetch()
    const ui = renderHome()
    await userEvent.type(ui.field(), '   ')
    await userEvent.click(ui.button())
    expect(screen.getByRole('alert')).toHaveTextContent('רווחים זה נחמד, אבל תנו לנו נושא אמיתי 😅')
    expect(fetchMock).not.toHaveBeenCalled()

    await userEvent.type(ui.field(), 'א')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['a service failure', { status: 500, body: { code: 'INTERNAL_ERROR', message: 'x' } }, 'אופס, הקומיקאי מעד על הבמה 🤕 אפשר לנסות שוב.'],
    ['a timeout', { status: 504, body: { code: 'AI_TIMEOUT', message: 'x' } }, 'הבדיחה מתבשלת יותר מדי זמן ⏳ אפשר לנסות שוב.'],
    ['a refusal', { status: 422, body: { code: 'UNSUPPORTED_TOPIC', message: 'x' } }, 'אפילו לנו יש גבולות להומור 😅 אפשר לנסות נושא אחר!'],
  ])('on %s keeps the joke and topic, shows the message and retries only manually', async (_label, failure, text) => {
    const { fetchMock, respond } = mockFetch()
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
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await userEvent.click(ui.button())
    expect(fetchMock).toHaveBeenCalledTimes(3)
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
