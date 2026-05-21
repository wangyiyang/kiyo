import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateLyrics,
  generateText,
  generateImage,
  generateMusic,
  generateCover,
  getProviderForTask,
  ProviderError,
} from '../index'

const originalFetch = globalThis.fetch
const originalEnv = process.env

describe('Provider Registry', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    process.env = originalEnv
    globalThis.fetch = originalFetch
  })

  describe('getProviderForTask', () => {
    it('returns correct defaults for all tasks', () => {
      expect(getProviderForTask('lyrics')).toBe('minimax')
      expect(getProviderForTask('text')).toBe('gmi')
      expect(getProviderForTask('image')).toBe('minimax')
      expect(getProviderForTask('music')).toBe('minimax')
      expect(getProviderForTask('cover')).toBe('minimax')
    })

    it('reads provider from environment variables', () => {
      process.env.PROVIDER_LYRICS = 'gmi'
      process.env.PROVIDER_TEXT = 'gmi'
      expect(getProviderForTask('lyrics')).toBe('gmi')
      expect(getProviderForTask('text')).toBe('gmi')
    })
  })

  describe('generateLyrics', () => {
    it('routes to minimax when PROVIDER_LYRICS is not set', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Minimax lyrics' }),
      } as Response)

      process.env.MINIMAX_API_KEY = 'test-minimax-key'
      const result = await generateLyrics({ prompt: 'test' })
      expect(result.text).toBe('Minimax lyrics')
    })

    it('routes to gmi when PROVIDER_LYRICS=gmi', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'GMI lyrics' } }],
        }),
      } as Response)

      process.env.PROVIDER_LYRICS = 'gmi'
      process.env.GMI_API_KEY = 'test-gmi-key'
      const result = await generateLyrics({ prompt: 'test' })
      expect(result.text).toBe('GMI lyrics')
    })

    it('throws ProviderError on API failure', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'bad request' }),
      } as Response)

      process.env.MINIMAX_API_KEY = 'test-key'
      await expect(generateLyrics({ prompt: 'test' })).rejects.toBeInstanceOf(ProviderError)
    })
  })

  describe('generateText', () => {
    it('routes to gmi when PROVIDER_TEXT=gmi', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'GMI text' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response)

      process.env.PROVIDER_TEXT = 'gmi'
      process.env.GMI_API_KEY = 'test-gmi-key'
      const result = await generateText({ userPrompt: 'hello' })
      expect(result.text).toBe('GMI text')
      expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5 })
    })
  })

  describe('generateMusic', () => {
    it('routes to minimax by default', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://example.com/audio.mp3' },
          extra_info: { music_duration: 120000 },
        }),
      } as Response)

      process.env.MINIMAX_API_KEY = 'test-key'
      const result = await generateMusic({ prompt: 'test' })
      expect(result.audioUrl).toBe('https://example.com/audio.mp3')
      expect(result.duration).toBe(120)
    })
  })

  describe('generateImage', () => {
    it('routes to minimax by default', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { image_urls: ['https://example.com/image.png'] },
        }),
      } as Response)

      process.env.MINIMAX_API_KEY = 'test-key'
      const result = await generateImage({ prompt: 'test' })
      expect(result.imageUrl).toBe('https://example.com/image.png')
    })
  })

  describe('generateCover', () => {
    it('routes to minimax by default', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://example.com/cover.mp3' },
          extra_info: { music_duration: 180000 },
        }),
      } as Response)

      process.env.MINIMAX_API_KEY = 'test-key'
      const result = await generateCover({ voiceStyle: 'test', audioUrl: 'https://example.com/audio.mp3' })
      expect(result.audioUrl).toBe('https://example.com/cover.mp3')
      expect(result.duration).toBe(180)
    })
  })
})
