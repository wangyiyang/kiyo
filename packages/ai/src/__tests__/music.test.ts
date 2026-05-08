import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateMusic } from '../music'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateMusic', () => {
  it('returns audioUrl and duration on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          audio: 'https://example.com/audio.mp3',
        },
        extra_info: {
          music_duration: 12500,
        },
      }),
    } as Response)

    const result = await generateMusic({ prompt: 'a happy song' })
    expect(result.audioUrl).toBe('https://example.com/audio.mp3')
    expect(result.duration).toBe(13)
  })

  it('passes lyricsOptimizer to request body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { audio: 'https://example.com/audio.mp3' },
        extra_info: { music_duration: 10000 },
      }),
    } as Response)

    await generateMusic({ prompt: 'test', lyrics: 'hello world', lyricsOptimizer: true })

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.lyrics_optimizer).toBe(true)
    expect(requestBody.lyrics).toBe('hello world')
  })

  it('passes isInstrumental to request body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { audio: 'https://example.com/audio.mp3' },
        extra_info: { music_duration: 10000 },
      }),
    } as Response)

    await generateMusic({ prompt: 'test', isInstrumental: true })

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.is_instrumental).toBe(true)
  })

  it('passes lyrics to request body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { audio: 'https://example.com/audio.mp3' },
        extra_info: { music_duration: 10000 },
      }),
    } as Response)

    await generateMusic({ prompt: 'test', lyrics: 'my lyrics' })

    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const requestBody = JSON.parse(fetchCall[1].body)
    expect(requestBody.lyrics).toBe('my lyrics')
  })

  it('throws MinimaxError when API returns invalid data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {},
      }),
    } as Response)

    await expect(generateMusic({ prompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })
})
