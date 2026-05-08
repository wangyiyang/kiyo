import { createServerClient } from '@kiyo/supabase'
import { generateMusic, MinimaxError } from '@kiyo/ai'
import { NextResponse } from 'next/server'

const VALID_MODES = ['instrumental', 'auto_lyrics', 'existing_lyric'] as const
type Mode = (typeof VALID_MODES)[number]

const LANGUAGE_MAP: Record<string, string> = {
  zh: '中文',
  en: '英文',
  ja: '日文',
}

function buildPrompt(prompt: string, language?: string, genre?: string, mood?: string): string {
  const parts: string[] = []
  if (language && LANGUAGE_MAP[language]) {
    parts.push(LANGUAGE_MAP[language])
  }
  parts.push(prompt)
  if (genre) parts.push(`风格：${genre}`)
  if (mood) parts.push(`情绪：${mood}`)
  return parts.join('，')
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
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

  const { prompt, mode, genre, mood, language, lyric_id } = body

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } },
      { status: 400 }
    )
  }

  if (!VALID_MODES.includes(mode as Mode)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid mode' } },
      { status: 400 }
    )
  }

  if (mode === 'existing_lyric') {
    if (!lyric_id || typeof lyric_id !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'lyric_id is required for existing_lyric mode' } },
        { status: 400 }
      )
    }

    const { data: lyric, error: lyricError } = await supabase
      .from('lyrics')
      .select('id, user_id, content')
      .eq('id', lyric_id)
      .single()

    if (lyricError || !lyric) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
        { status: 404 }
      )
    }

    if (lyric.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to use this lyric' } },
        { status: 403 }
      )
    }
  }

  const fullPrompt = buildPrompt(prompt.trim(), typeof language === 'string' ? language : undefined, typeof genre === 'string' ? genre : undefined, typeof mood === 'string' ? mood : undefined)

  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: prompt.trim().slice(0, 100),
      lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
      genre: typeof genre === 'string' ? genre : null,
      mood: typeof mood === 'string' ? mood : null,
      ai_prompt: fullPrompt,
      status: 'generating',
      source: 'ai_generated',
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
    const generateOptions: {
      prompt: string
      genre?: string
      mood?: string
      isInstrumental?: boolean
      lyricsOptimizer?: boolean
      lyrics?: string
    } = {
      prompt: fullPrompt,
    }

    if (typeof genre === 'string') generateOptions.genre = genre
    if (typeof mood === 'string') generateOptions.mood = mood

    if (mode === 'instrumental') {
      generateOptions.isInstrumental = true
    } else if (mode === 'auto_lyrics') {
      generateOptions.lyricsOptimizer = true
    } else if (mode === 'existing_lyric') {
      const { data: lyric } = await supabase
        .from('lyrics')
        .select('content')
        .eq('id', lyric_id as string)
        .single()
      generateOptions.lyrics = lyric?.content ?? ''
    }

    const result = await generateMusic(generateOptions)

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
        source: 'ai_generated',
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
    const message = err instanceof Error ? err.message : 'Music generation failed'

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
