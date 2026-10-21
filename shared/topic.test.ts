import { describe, expect, it } from 'vitest'
import { validateTopic } from './topic.js'

describe('validateTopic', () => {
  it('accepts an empty topic (general joke)', () => {
    expect(validateTopic('')).toEqual({ ok: true })
  })

  it('rejects whitespace-only input', () => {
    expect(validateTopic('   ')).toEqual({ ok: false, reason: 'whitespace' })
    expect(validateTopic('\t\n ')).toEqual({ ok: false, reason: 'whitespace' })
  })

  it('accepts up to 100 characters and rejects 101', () => {
    expect(validateTopic('א'.repeat(100))).toEqual({ ok: true })
    expect(validateTopic('א'.repeat(101))).toEqual({ ok: false, reason: 'too-long' })
  })

  it('accepts topics in any language', () => {
    expect(validateTopic('cats')).toEqual({ ok: true })
    expect(validateTopic('חתולים')).toEqual({ ok: true })
  })
})
