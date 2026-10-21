import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
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

  it('does not show a fake joke or message on submit', async () => {
    renderHome()
    const before = document.body.textContent
    await userEvent.click(screen.getByRole('button', { name: 'צור בדיחה' }))
    await userEvent.type(screen.getByLabelText('נושא לבדיחה'), '{Enter}')
    expect(document.body.textContent).toBe(before)
  })
})

describe('document setup', () => {
  it('is Hebrew, right-to-left and titled בדיחומט', () => {
    expect(indexHtml).toContain('<html lang="he" dir="rtl">')
    expect(indexHtml).toContain('<title>בדיחומט</title>')
  })
})
