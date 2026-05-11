import { createServerClient } from '@kiyo/supabase/server'
import { captureAppException } from '@/lib/monitoring'
import { generateCover, MinimaxError } from '@kiyo/ai'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // Rate limiting
  const rateLimit = await checkRateLimit('cover_generate', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { voice_style, audio_url, original_song_id, title } = body

  if (!voice_style || typeof voice_style !== 'string' || voice_style.length < 10 || voice_style.length > 300) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'voice_style must be between 10 and 300 characters' } },
      { status: 400 }
    )
  }

  if (!audio_url || typeof audio_url !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'audio_url is required' } },
      { status: 400 }
    )
  }

  let originalSong: { title: string; lyric_id: string | null; audio_url: string | null } | null = null

  if (original_song_id && typeof original_song_id === 'string') {
    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('title, lyric_id, audio_url, user_id')
      .eq('id', original_song_id)
      .eq('user_id', user.id)
      .single()

    if (songError || !song) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Original song not found' } },
        { status: 404 }
      )
    }

    if (!song.audio_url) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '原歌曲没有可用音频' } },
        { status: 400 }
      )
    }

    originalSong = song
  }

  const songTitle = typeof title === 'string' && title.trim()
    ? title.trim()
    : originalSong
      ? `${originalSong.title} 的翻唱`
      : 'AI 翻唱作品'

  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: songTitle.slice(0, 200),
      lyric_id: originalSong?.lyric_id ?? null,
      status: 'generating',
      source: 'ai_cover',
      original_song_id: typeof original_song_id === 'string' ? original_song_id : null,
      voice_style: voice_style,
      user_id: user.id,
    })
    .select()
    .single()

  if (insertError || !song) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: insertError?.message ?? 'Failed to create song' } },
      { status: 500 }
    )
  }

  try {
    const result = await generateCover({
      voiceStyle: voice_style,
      audioUrl: audio_url as string,
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

    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: publicUrl.publicUrl,
        duration: result.duration,
        status: 'completed',
      })
      .eq('id', song.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return NextResponse.json({ song: updatedSong })
  } catch (err) {
    captureAppException(err, {
      tags: { area: 'songs', operation: 'cover' },
    })
    const message = err instanceof Error ? err.message : 'Cover generation failed'

    await supabase
      .from('songs')
      .update({ status: 'failed' })
      .eq('id', song.id)

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
