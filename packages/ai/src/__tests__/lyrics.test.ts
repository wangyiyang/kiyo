import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateLyrics } from '../lyrics'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateLyrics', () => {
  it('returns text on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: 'La la la, love song',
      }),
    } as Response)

    const result = await generateLyrics({ prompt: 'Write a love song' })
    expect(result.text).toBe('La la la, love song')
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid prompt' }),
    } as Response)

    await expect(generateLyrics({ prompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })

  it('throws MinimaxError when text is missing in response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response)

    await expect(generateLyrics({ prompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })

  it('forwards custom mode in request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ text: 'custom mode result' }),
    } as Response)
    globalThis.fetch = fetchMock

    const result = await generateLyrics({ prompt: 'test', mode: 'write_full_song' })
    expect(result.text).toBe('custom mode result')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(requestBody.mode).toBe('write_full_song')
    expect(requestBody.prompt).toBe('test')
  })
})
