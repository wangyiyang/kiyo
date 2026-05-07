import { minimaxFetch } from './client'
import { MinimaxError } from './errors'

export interface GenerateLyricsOptions {
  prompt: string
  mode?: 'write_full_song'
}

export interface GenerateLyricsResult {
  text: string
}

export async function generateLyrics(
  options: GenerateLyricsOptions
): Promise<GenerateLyricsResult> {
  const response = await minimaxFetch('/v1/lyrics_generation', {
    method: 'POST',
    body: JSON.stringify({
      mode: options.mode ?? 'write_full_song',
      prompt: options.prompt,
    }),
  })

  const data = response as { text?: string }
  if (!data.text) {
    throw new MinimaxError('Invalid response from lyrics generation API', 'api_error')
  }

  return { text: data.text }
}
