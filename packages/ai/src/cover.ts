import { minimaxFetch } from './client'
import { MinimaxError } from './errors'

export interface GenerateCoverOptions {
  voiceStyle: string
  audioUrl: string
}

export interface GenerateCoverResult {
  audioUrl: string
  duration: number
}

export async function generateCover(
  options: GenerateCoverOptions
): Promise<GenerateCoverResult> {
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

  const response = await minimaxFetch('/v1/music_generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    data?: { audio?: string; status?: number }
    extra_info?: { music_duration?: number }
  }

  if (!data.data?.audio) {
    throw new MinimaxError('Invalid response from cover API', 'api_error')
  }

  const durationMs = data.extra_info?.music_duration ?? 0
  const durationSeconds = Math.round(durationMs / 1000)

  return {
    audioUrl: data.data.audio,
    duration: durationSeconds,
  }
}
