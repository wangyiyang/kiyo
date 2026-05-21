// Legacy Minimax exports (backward compatible)
export { MinimaxError } from './src/errors'
export type { MinimaxErrorCode } from './src/errors'
export { minimaxFetch } from './src/client'
export { generateImage } from './src/image'
export type { GenerateImageOptions, GenerateImageResult } from './src/image'
export { generateText } from './src/text'
export type { GenerateTextOptions, GenerateTextResult } from './src/text'
export { generateMusic } from './src/music'
export type { GenerateMusicOptions, GenerateMusicResult } from './src/music'
export { generateLyrics } from './src/lyrics'
export type { GenerateLyricsOptions, GenerateLyricsResult } from './src/lyrics'
export { generateCover } from './src/cover'
export type { GenerateCoverOptions, GenerateCoverResult } from './src/cover'

// Provider-based exports (multi-provider support)
export {
  generateLyrics as routeLyrics,
  generateText as routeText,
  generateImage as routeImage,
  generateMusic as routeMusic,
  generateCover as routeCover,
  getProviderForTask,
  ProviderError,
  createMinimaxFallback,
  createGmiFallback,
} from './src/providers'
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
} from './src/providers'
