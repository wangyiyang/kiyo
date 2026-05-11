import { createServerClient } from '@kiyo/supabase/server'
import { captureAppException } from '@/lib/monitoring'
import { generateMusic, MinimaxError } from '@kiyo/ai'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // Rate limiting
  const rateLimit = await checkRateLimit('song_generate', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('*, lyrics(content)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (songError || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (!song.lyric_id) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Song must have a lyric to generate music' } },
      { status: 400 }
    )
  }

  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', params.id)

  try {
    const lyricsContent = song.lyrics?.content ?? ''
    const result = await generateMusic({
      prompt: song.ai_prompt ?? undefined,
      lyrics: lyricsContent,
      genre: song.genre ?? undefined,
      mood: song.mood ?? undefined,
    })

    const audioResponse = await fetch(result.audioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio')
    }
    const audioBuffer = await audioResponse.arrayBuffer()

    const filePath = `${user.id}/${song.id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({
        file_path: filePath,
        audio_url: null,
        duration: result.duration,
        status: 'completed',
        source: 'ai_generated',
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return NextResponse.json({ song: updatedSong })
  } catch (err) {
    captureAppException(err, {
      tags: { area: 'songs', operation: 'regenerate' },
    })
    const message = err instanceof Error ? err.message : 'Music generation failed'

    await supabase
      .from('songs')
      .update({ status: 'failed' })
      .eq('id', params.id)

    const isMinimaxError = err instanceof MinimaxError
    return NextResponse.json(
      {
        error: {
          code: isMinimaxError ? 'GENERATION_FAILED' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isMinimaxError ? 422 : 500 }
    )
  }
}
