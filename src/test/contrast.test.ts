import { describe, expect, it } from 'vitest'
import tokens from '../styles/tokens.css?raw'

// WCAG 2 contrast for the text/background pairs the screens actually use (DESIGN §2.5).

const color = (name: string): string => {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  if (!match) throw new Error(`missing token --${name}`)
  return match[1]
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('text contrast is at least 4.5:1', () => {
  it.each([
    ['body text on the page', 'text', 'background'],
    ['secondary text and balance line on the page', 'text-secondary', 'background'],
    ['placeholder and counter in the field', 'text-secondary', 'surface'],
    ['brand title on the page', 'primary-yellow', 'background'],
    ['primary button label', 'white', 'primary-red'],
    ['primary button label on hover', 'white', 'primary-red-hover'],
    ['messages', 'text', 'message-bg'],
    ['18+ badge', 'primary-yellow', 'background'],
    ['secondary button', 'text', 'surface'],
    ['joke card text', 'text', 'surface'],
  ])('%s', (_label, text, background) => {
    expect(ratio(color(text), color(background))).toBeGreaterThanOrEqual(4.5)
  })
})
