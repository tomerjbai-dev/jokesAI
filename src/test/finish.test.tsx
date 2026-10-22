import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.tsx'

// Milestone 5: heading structure, AI output as text, privacy on reopen.

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const stubFetch = (joke: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url === '/api/status'
        ? new Response(JSON.stringify({ remainingToday: 7, dailyLimit: 20, globalAvailableEstimate: true }))
        : new Response(JSON.stringify({ joke, remainingToday: 6 })),
    ),
  )

const h1Count = () => screen.getAllByRole('heading', { level: 1 }).length

describe('one h1 per screen', () => {
  it('age gate, access denied, home and offline each have exactly one h1', async () => {
    stubFetch('x')
    render(<App />)
    expect(h1Count()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'לא, אני מתחת לגיל 18' }))
    expect(h1Count()).toBe(1)
    await userEvent.click(screen.getByRole('button', { name: 'חזרה להצהרת הגיל' }))
    await userEvent.click(screen.getByRole('button', { name: 'כן, אני מעל גיל 18' }))
    expect(screen.getByRole('heading', { level: 1, name: 'בדיחומט' })).toBeInTheDocument()
    expect(h1Count()).toBe(1)

    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => false)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    // The hidden home screen is out of the accessibility tree, so only the offline h1 counts.
    expect(h1Count()).toBe(1)
    expect(screen.getByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט')
  })
})

describe('AI output is shown as text, never as HTML', () => {
  it('renders markup in a joke literally', async () => {
    const joke = '<img src=x onerror="alert(1)"><b>מודגש</b><script>alert(2)</script>'
    stubFetch(joke)
    localStorage.setItem('ageConfirmed', 'true')
    const { container } = render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'צור בדיחה' }))

    expect(await screen.findByText(joke)).toBeInTheDocument()
    expect(container.querySelector('img, b, script')).toBeNull()
  })

  it('no source file injects HTML', () => {
    const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../test/**'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    expect(Object.keys(sources).length).toBeGreaterThan(5)
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML/)
    }
  })
})

describe('reopening the app', () => {
  it('starts with an empty topic and no joke, but keeps age consent and the balance', async () => {
    stubFetch('בדיחה על חתולים')
    localStorage.setItem('ageConfirmed', 'true')
    const first = render(<App />)
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), 'חתולים')
    await userEvent.click(screen.getByRole('button', { name: 'צור בדיחה' }))
    expect(await screen.findByText('בדיחה על חתולים')).toBeInTheDocument()
    first.unmount()

    render(<App />)
    await act(async () => {})
    // Straight to home (consent kept), with the intro back and nothing restored.
    expect(screen.getByRole('heading', { name: 'על מה צוחקים היום? 😂' })).toBeInTheDocument()
    expect(screen.getByLabelText('נושא לבדיחה')).toHaveValue('')
    expect(screen.queryByText('בדיחה על חתולים')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'צור בדיחה' })).toBeInTheDocument()
    // The balance comes from the server (the signed cookie), not from anything stored in the page.
    expect(screen.getByText('נשארו 7 בדיחות היום')).toBeInTheDocument()
  })

  it('stores nothing but the age consent in browser storage', async () => {
    stubFetch('בדיחה')
    localStorage.clear()
    sessionStorage.clear()
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'כן, אני מעל גיל 18' }))
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), 'ים')
    await userEvent.click(screen.getByRole('button', { name: 'צור בדיחה' }))
    await screen.findByText('בדיחה')

    expect(Object.keys(localStorage)).toEqual(['ageConfirmed'])
    expect(sessionStorage.length).toBe(0)
  })
})
