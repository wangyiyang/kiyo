import {
  type AIProvider,
  type ProviderConfig,
  type LyricsOptions,
  type LyricsResult,
  type TextOptions,
  type TextResult,
  ProviderError,
} from './types'

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
      throw new ProviderError('Request timed out', 'gmi', 'timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function gmiFetchWithRetry(
  config: ProviderConfig & { defaultModel?: string },
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
        config.timeoutMs ?? 120000
      )

      if (response.status === 429) {
        const body = await response.json().catch(() => undefined)
        throw new ProviderError('Rate limit exceeded', 'gmi', 'rate_limit', 429, body)
      }

      if (!response.ok) {
        const body = await response.json().catch(() => undefined)
        throw new ProviderError(
          `GMI API error: ${response.status}`,
          'gmi',
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
          'gmi',
          'network'
        )
      }

      await delay(2 ** attempt * 1000)
      attempt++
    }
  }
}

const LYRICS_SYSTEM_PROMPT = `你是一位才华横溢的作词人。请根据用户的描述创作歌词。
要求：
- 只输出歌词内容，不要有任何解释或说明
- 歌词要有韵律感和节奏感
- 可以适当添加段落标记如 [Verse]、[Chorus]、[Bridge]
- 保持歌词的文学性和情感表达`

export function createGmiProvider(): AIProvider {
  const config = {
    name: 'gmi' as const,
    apiKey: process.env.GMI_API_KEY ?? '',
    baseUrl: process.env.GMI_BASE_URL ?? 'https://api.gmi-serving.com',
    timeoutMs: Number(process.env.GMI_TIMEOUT_MS ?? '120000'),
    maxRetries: Number(process.env.GMI_MAX_RETRIES ?? '3'),
    defaultModel: process.env.GMI_DEFAULT_MODEL ?? 'deepseek-ai/DeepSeek-V4-Flash',
  }

  return {
    name: 'gmi',

    async generateLyrics(options: LyricsOptions): Promise<LyricsResult> {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: LYRICS_SYSTEM_PROMPT },
        { role: 'user', content: options.prompt },
      ]

      const body = {
        model: config.defaultModel,
        messages,
        temperature: 0.8,
        max_tokens: 2000,
      }

      const response = (await gmiFetchWithRetry(config, '/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        choices?: Array<{ message?: { content?: string } }>
      }

      const text = response.choices?.[0]?.message?.content
      if (!text) {
        throw new ProviderError('Invalid response from lyrics generation API', 'gmi', 'api_error')
      }
      return { text }
    },

    async generateText(options: TextOptions): Promise<TextResult> {
      const messages: Array<{ role: string; content: string }> = []
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt })
      }
      messages.push({ role: 'user', content: options.userPrompt })

      const body = {
        model: options.model ?? config.defaultModel,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }

      const response = (await gmiFetchWithRetry(config, '/v1/chat/completions', {
        method: 'POST',
        body: JSON.stringify(body),
      })) as {
        choices?: Array<{ message?: { content?: string } }>
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }

      const text = response.choices?.[0]?.message?.content
      if (!text) {
        throw new ProviderError('Invalid response from text generation API', 'gmi', 'api_error')
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
  }
}
