import {
  type AIProvider,
  type ProviderConfig,
  type LyricsOptions,
  type LyricsResult,
  type TextOptions,
  type TextResult,
  type ImageOptions,
  type ImageResult,
  type MusicOptions,
  type MusicResult,
  type CoverOptions,
  type CoverResult,
  ProviderError,
} from './types'
import { MinimaxError } from '../errors'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ProviderError('Request timed out', 'minimax', 'timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function minimaxFetchWithRetry(
  config: ProviderConfig,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${config.baseUrl}${path}`
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${config.apiKey}`)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let attempt = 0
  while (true) {
    try {
      const response = await fetchWithTimeout(
        url,
        { ...options, headers },
        config.timeoutMs ?? 300000
      )

      if (response.status === 429) {
        const body = await response.json().catch(() => undefined)
        throw new ProviderError('Rate limit exceeded', 'minimax', 'rate_limit', 429, body)
      }

      if (!response.ok) {
        const body = await response.json().catch(() => undefined)
        throw new ProviderError(
          `Minimax API error: ${response.status}`,
          'minimax',
          'api_error',
          response.status,
          body
        )
      }

      return await response.json()
    } catch (err) {
      if (err instanceof ProviderError) throw err

      const isLastAttempt = attempt === (config.maxRetries ?? 3)
      if (isLastAttempt) {
        throw new ProviderError(
          err instanceof Error ? err.message : 'Network request failed',
          'minimax',
          'network'
        )
      }

      await delay(2 ** attempt * 1000)
      attempt++
    }
  }
}

export function createMinimaxProvider(): AIProvider {
  const config = {
    name: 'minimax' as const,
    apiKey: process.env.MINIMAX_API_KEY ?? '',
    baseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com',
    timeoutMs: Number(process.env.MINIMAX_TIMEOUT_MS ?? '300000'),
    maxRetries: Number(process.env.MINIMAX_MAX_RETRIES ?? '3'),
  }

  return {
    name: 'minimax',

    async generateLyrics(options: LyricsOptions): Promise<LyricsResult> {
      const response = (await minimaxFetchWithRetry(config, '/v1/lyrics_generation', {
        method: 'POST',
        body: JSON.stringify({
          mode: options.mode ?? 'write_full_song',
          prompt: options.prompt,
        }),
      })) as { lyrics?: string; text?: string }

      const lyricsText = response.lyrics ?? response.text
      if (!lyricsText) {
        throw new ProviderError('Invalid response from lyrics generation API', 'minimax', 'api_error')
      }
      return { text: lyricsText }
    },

    async generateText(options: TextOptions): Promise<TextResult> {
      const messages: Array<{ role: string; content: string }> = []
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt })
      }
      messages.push({ role: 'user', content: options.userPrompt })

      const body = {
        model: options.model,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }

      const response = (await minimaxFetchWithRetry(config, '/v1/text/chatcompletion_v2', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }

      const text = response.choices?.[0]?.message?.content
      if (!text) {
        throw new ProviderError('Invalid response from text generation API', 'minimax', 'api_error')
      }

      return {
        text,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens ?? 0,
              completionTokens: response.usage.completion_tokens ?? 0,
            }
          : undefined,
      }
    },

    async generateImage(options: ImageOptions): Promise<ImageResult> {
      const body = {
        prompt: options.prompt,
        width: options.width,
        height: options.height,
        model: options.model || 'image-01',
      }

      const response = (await minimaxFetchWithRetry(config, '/v1/image_generation', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as { data?: { image_urls?: string[] } }

      const imageUrl = response.data?.image_urls?.[0]
      if (!imageUrl) {
        throw new ProviderError('Invalid response from image generation API', 'minimax', 'api_error')
      }
      return { imageUrl }
    },

    async generateMusic(options: MusicOptions): Promise<MusicResult> {
      const parts: string[] = []
      if (options.prompt) parts.push(options.prompt)
      if (options.genre) parts.push(`风格：${options.genre}`)
      if (options.mood) parts.push(`情绪：${options.mood}`)
      const fullPrompt = parts.join('，')

      const body: Record<string, unknown> = {
        model: 'music-2.6',
        output_format: 'url',
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3',
        },
      }

      if (fullPrompt) body.prompt = fullPrompt
      if (options.lyrics) body.lyrics = options.lyrics
      if (options.isInstrumental) body.is_instrumental = true
      if (options.lyricsOptimizer) body.lyrics_optimizer = true

      const response = (await minimaxFetchWithRetry(config, '/v1/music_generation', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        data?: { audio?: string; status?: number }
        extra_info?: { music_duration?: number }
      }

      if (!response.data?.audio) {
        throw new ProviderError('Invalid response from music generation API', 'minimax', 'api_error')
      }

      const durationMs = response.extra_info?.music_duration ?? 0
      return {
        audioUrl: response.data.audio,
        duration: Math.round(durationMs / 1000),
      }
    },

    async generateCover(options: CoverOptions): Promise<CoverResult> {
      const body = {
        model: 'music-cover',
        prompt: options.voiceStyle,
        audio_url: options.audioUrl,
        output_format: 'url',
        audio_setting: {
          sample_rate: 44100,
          bitrate: 256000,
          format: 'mp3',
        },
      }

      const response = (await minimaxFetchWithRetry(config, '/v1/music_generation', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        data?: { audio?: string; status?: number }
        extra_info?: { music_duration?: number }
      }

      if (!response.data?.audio) {
        throw new ProviderError('Invalid response from cover API', 'minimax', 'api_error')
      }

      const durationMs = response.extra_info?.music_duration ?? 0
      return {
        audioUrl: response.data.audio,
        duration: Math.round(durationMs / 1000),
      }
    },
  }
}
