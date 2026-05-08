import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateCover } from '../cover'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateCover', () => {
  it('returns audioUrl and duration on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { audio: 'https://cdn.minimaxi.com/audio/cover.mp3', status: 1 },
        extra_info: { music_duration: 180000 },
      }),
    } as Response)

    const result = await generateCover({
      voiceStyle: '爵士钢琴版，慵懒萨克斯，舒缓节奏',
      audioUrl: 'https://example.com/original.mp3',
    })

    expect(result.audioUrl).toBe('https://cdn.minimaxi.com/audio/cover.mp3')
    expect(result.duration).toBe(180)
  })

  it('sends correct request body to music-cover endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { audio: 'https://cdn.minimaxi.com/audio/cover.mp3', status: 1 },
        extra_info: { music_duration: 120000 },
      }),
    } as Response)

    await generateCover({
      voiceStyle: '流行摇滚版，节奏更快',
      audioUrl: 'https://example.com/song.mp3',
    })

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.model).toBe('music-cover')
    expect(body.prompt).toBe('流行摇滚版，节奏更快')
    expect(body.audio_url).toBe('https://example.com/song.mp3')
    expect(body.output_format).toBe('url')
    expect(body.audio_setting).toEqual({
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    })
  })

  it('throws MinimaxError when API returns no audio', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    } as Response)

    await expect(
      generateCover({ voiceStyle: 'test', audioUrl: 'https://example.com/test.mp3' })
    ).rejects.toBeInstanceOf(MinimaxError)
  })
})
