import { MinimaxError } from '../errors'

export type ProviderName = 'minimax' | 'gmi'

export interface ProviderConfig {
  name: ProviderName
  apiKey: string
  baseUrl?: string
  timeoutMs?: number
  maxRetries?: number
}

export interface LyricsOptions {
  prompt: string
  mode?: 'write_full_song'
}

export interface LyricsResult {
  text: string
}

export interface TextOptions {
  systemPrompt?: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface TextResult {
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}

export interface ImageOptions {
  prompt: string
  width?: number
  height?: number
  model?: string
}

export interface ImageResult {
  imageUrl: string
}

export interface MusicOptions {
  prompt?: string
  lyrics?: string
  genre?: string
  mood?: string
  isInstrumental?: boolean
  lyricsOptimizer?: boolean
}

export interface MusicResult {
  audioUrl: string
  duration: number
}

export interface CoverOptions {
  voiceStyle: string
  audioUrl: string
}

export interface CoverResult {
  audioUrl: string
  duration: number
}

export interface AIProvider {
  readonly name: ProviderName
  generateLyrics?(options: LyricsOptions): Promise<LyricsResult>
  generateText?(options: TextOptions): Promise<TextResult>
  generateImage?(options: ImageOptions): Promise<ImageResult>
  generateMusic?(options: MusicOptions): Promise<MusicResult>
  generateCover?(options: CoverOptions): Promise<CoverResult>
}

export class ProviderError extends MinimaxError {
  constructor(
    message: string,
    public provider: ProviderName,
    code: 'network' | 'timeout' | 'rate_limit' | 'api_error' | 'unknown' | 'not_supported',
    statusCode?: number,
    responseBody?: unknown
  ) {
    super(message, code, statusCode, responseBody)
    this.name = 'ProviderError'
  }
}
