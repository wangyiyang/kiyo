import { minimaxFetch } from './client'
import { MinimaxError } from './errors'

export interface GenerateMusicOptions {
  prompt?: string
  lyrics?: string
  genre?: string
  mood?: string
  isInstrumental?: boolean
}

export interface GenerateMusicResult {
  audioUrl: string
  duration: number
}

export async function generateMusic(
  options: GenerateMusicOptions
): Promise<GenerateMusicResult> {
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

  if (fullPrompt) {
    body.prompt = fullPrompt
  }

  if (options.lyrics) {
    body.lyrics = options.lyrics
  }

  if (options.isInstrumental) {
    body.is_instrumental = true
  }

  const response = await minimaxFetch('/v1/music_generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    data?: { audio?: string; status?: number }
    extra_info?: { music_duration?: number }
  }

  if (!data.data?.audio) {
    throw new MinimaxError('Invalid response from music generation API', 'api_error')
  }

  const durationMs = data.extra_info?.music_duration ?? 0
  const durationSeconds = Math.round(durationMs / 1000)

  return {
    audioUrl: data.data.audio,
    duration: durationSeconds,
  }
}
