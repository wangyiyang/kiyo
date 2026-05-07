import { MinimaxError } from './errors'

export interface GenerateMusicOptions {
  style?: string
  mood?: string
  lyrics?: string
  duration?: number
}

export interface GenerateMusicResult {
  audioUrl: string
}

export async function generateMusic(
  _options: GenerateMusicOptions
): Promise<GenerateMusicResult> {
  throw new MinimaxError('Music generation is not yet implemented', 'unknown')
}
