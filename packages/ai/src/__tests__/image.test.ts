import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateImage } from '../image'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateImage', () => {
  it('returns imageUrl on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          image_url: 'https://example.com/image.png',
        },
      }),
    } as Response)

    const result = await generateImage({ prompt: 'a red cat', width: 512, height: 512 })
    expect(result.imageUrl).toBe('https://example.com/image.png')
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad prompt' }),
    } as Response)

    await expect(generateImage({ prompt: 'bad' })).rejects.toBeInstanceOf(MinimaxError)
  })
})
