import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateText } from '../text'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateText', () => {
  it('returns text and usage on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Hello world' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    } as Response)

    const result = await generateText({ userPrompt: 'Say hello' })
    expect(result.text).toBe('Hello world')
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 })
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid model' }),
    } as Response)

    await expect(generateText({ userPrompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })
})
