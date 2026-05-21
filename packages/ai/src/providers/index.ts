import { createMinimaxProvider } from './minimax'
import { createGmiProvider } from './gmi'
import { getProviderForTask } from './config'
import {
  type AIProvider,
  type ProviderName,
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

const providers = new Map<ProviderName, AIProvider>()

function getProvider(name: ProviderName): AIProvider {
  let provider = providers.get(name)
  if (!provider) {
    switch (name) {
      case 'minimax':
        provider = createMinimaxProvider()
        break
      case 'gmi':
        provider = createGmiProvider()
        break
      default:
        throw new ProviderError(`Unknown provider: ${name}`, name, 'unknown')
    }
    providers.set(name, provider)
  }
  return provider
}

function resolveProvider(task: keyof AIProvider): AIProvider {
  // Map task method name to task type
  const taskMap: Record<string, string> = {
    generateLyrics: 'lyrics',
    generateText: 'text',
    generateImage: 'image',
    generateMusic: 'music',
    generateCover: 'cover',
  }

  const taskType = taskMap[task] as 'lyrics' | 'text' | 'image' | 'music' | 'cover'
  const providerName = getProviderForTask(taskType)
  return getProvider(providerName)
}

export async function generateLyrics(options: LyricsOptions): Promise<LyricsResult> {
  const provider = resolveProvider('generateLyrics')
  if (!provider.generateLyrics) {
    throw new ProviderError('Provider does not support lyrics generation', provider.name, 'not_supported')
  }
  return provider.generateLyrics(options)
}

export async function generateText(options: TextOptions): Promise<TextResult> {
  const provider = resolveProvider('generateText')
  if (!provider.generateText) {
    throw new ProviderError('Provider does not support text generation', provider.name, 'not_supported')
  }
  return provider.generateText(options)
}

export async function generateImage(options: ImageOptions): Promise<ImageResult> {
  const provider = resolveProvider('generateImage')
  if (!provider.generateImage) {
    throw new ProviderError('Provider does not support image generation', provider.name, 'not_supported')
  }
  return provider.generateImage(options)
}

export async function generateMusic(options: MusicOptions): Promise<MusicResult> {
  const provider = resolveProvider('generateMusic')
  if (!provider.generateMusic) {
    throw new ProviderError('Provider does not support music generation', provider.name, 'not_supported')
  }
  return provider.generateMusic(options)
}

export async function generateCover(options: CoverOptions): Promise<CoverResult> {
  const provider = resolveProvider('generateCover')
  if (!provider.generateCover) {
    throw new ProviderError('Provider does not support cover generation', provider.name, 'not_supported')
  }
  return provider.generateCover(options)
}

// Export provider-specific functions for explicit fallback
export function createMinimaxFallback() {
  return createMinimaxProvider()
}

export function createGmiFallback() {
  return createGmiProvider()
}

export { getProviderForTask, ProviderError }
export type {
  AIProvider,
  ProviderName,
  LyricsOptions,
  LyricsResult,
  TextOptions,
  TextResult,
  ImageOptions,
  ImageResult,
  MusicOptions,
  MusicResult,
  CoverOptions,
  CoverResult,
}
