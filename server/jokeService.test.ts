// @vitest-environment node
import OpenAI from 'openai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateJoke, MAX_OUTPUT_TOKENS, type ResponsesClient } from './jokeService.js'

type FakeResponse = { status: string; output_text: string; output: unknown[] }
type SentParams = {
  model: string
  instructions: string
  input: string
  reasoning: unknown
  max_output_tokens: number
  text: { format: { type: string; strict: boolean; schema: { properties: { status: { enum: string[] } } } } }
}

function fakeClient(response: FakeResponse | Error) {
  const create = vi.fn(async (_params: SentParams, _options?: { signal?: AbortSignal; timeout?: number; maxRetries?: number }) => {
    if (response instanceof Error) throw response
    return response
  })
  const client = { responses: { create } } as unknown as ResponsesClient
  return { client, sent: () => create.mock.calls[0][0], options: () => create.mock.calls[0][1] }
}

const completed = (outputText: string): FakeResponse => ({ status: 'completed', output_text: outputText, output: [] })
const okJoke = completed('{"status":"joke","joke":"בדיחה"}')

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('generateJoke request', () => {
  it('uses gpt-5 by default with low reasoning, an output limit and a strict schema', async () => {
    vi.stubEnv('OPENAI_MODEL', '')
    const { client, sent } = fakeClient(okJoke)
    await generateJoke({ topic: 'חתולים' }, client)

    const params = sent()
    expect(params.model).toBe('gpt-5')
    expect(params.reasoning).toEqual({ effort: 'low' })
    expect(params.max_output_tokens).toBe(MAX_OUTPUT_TOKENS)
    expect(params.text.format).toMatchObject({ type: 'json_schema', strict: true })
    expect(params.text.format.schema.properties.status.enum).toEqual(['joke', 'refused'])
    expect(params.instructions).toMatch(/Hebrew only/)
    expect(params.input).toContain('<topic>חתולים</topic>')
    expect(params.input).not.toContain('previous_joke')
  })

  it('reads the model name from OPENAI_MODEL', async () => {
    vi.stubEnv('OPENAI_MODEL', 'gpt-5-mini')
    const { client, sent } = fakeClient(okJoke)
    await generateJoke({ topic: '' }, client)
    expect(sent().model).toBe('gpt-5-mini')
  })

  it('asks for a general joke on an empty topic and passes the previous joke as data', async () => {
    const { client, sent } = fakeClient(okJoke)
    await generateJoke({ topic: '', previousJoke: 'בדיחה ישנה' }, client)
    expect(sent().input).toContain('general joke')
    expect(sent().input).toContain('<previous_joke>בדיחה ישנה</previous_joke>')
  })

  it('never retries automatically, times out after 28 seconds and passes the abort signal', async () => {
    vi.stubEnv('AI_TIMEOUT_MS', '')
    const { client, options } = fakeClient(okJoke)
    const signal = new AbortController().signal
    await generateJoke({ topic: 'x' }, client, { signal })
    expect(options()).toEqual({ signal, timeout: 28000, maxRetries: 0 })
  })

  it.each([
    ['5000', 5000],
    ['not a number', 28000],
    ['-1', 28000],
  ])('reads AI_TIMEOUT_MS=%s as %i', async (value, expected) => {
    vi.stubEnv('AI_TIMEOUT_MS', value)
    const { client, options } = fakeClient(okJoke)
    await generateJoke({ topic: 'x' }, client)
    expect(options()?.timeout).toBe(expected)
  })
})

describe('generateJoke response handling', () => {
  it('returns the trimmed joke', async () => {
    const { client } = fakeClient(completed('{"status":"joke","joke":"  בדיחה מצחיקה  "}'))
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'joke', joke: 'בדיחה מצחיקה' })
  })

  it('treats status "refused" as a refusal', async () => {
    const { client } = fakeClient(completed('{"status":"refused","joke":""}'))
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'refused' })
  })

  it('treats a refusal content item as a refusal', async () => {
    const { client } = fakeClient({
      status: 'completed',
      output_text: '',
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }],
    })
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'refused' })
  })

  it.each([
    ['an incomplete response', { status: 'incomplete', output_text: '', output: [] }],
    ['invalid JSON', completed('not json')],
    ['an empty joke', completed('{"status":"joke","joke":"   "}')],
    ['an unexpected shape', completed('{"text":"hi"}')],
  ])('fails on %s', async (_label, response) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient(response)
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'failed' })
  })

  it('reports a timeout when the SDK times out', async () => {
    const { client } = fakeClient(new OpenAI.APIConnectionTimeoutError())
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'timeout' })
  })

  it('treats a client disconnect as a failure without logging an error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient(new OpenAI.APIUserAbortError())
    expect(await generateJoke({ topic: 'x' }, client)).toEqual({ kind: 'failed' })
    expect(log).not.toHaveBeenCalled()
  })

  it('fails when the SDK throws, without logging the topic', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeClient(new Error('network down'))
    expect(await generateJoke({ topic: 'סוד' }, client)).toEqual({ kind: 'failed' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('סוד')
  })
})
