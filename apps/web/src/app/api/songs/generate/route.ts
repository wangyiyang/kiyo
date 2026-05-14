import { createServerClient } from '@kiyo/supabase/server'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { triggerGenerationWorker } from '@/lib/generation-worker'
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

  // Rate limiting
  const rateLimit = await checkRateLimit('song_generate', user.id, request)
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

  const fullPrompt = buildPrompt(
    prompt.trim(),
    typeof language === 'string' ? language : undefined,
    typeof genre === 'string' ? genre : undefined,
    typeof mood === 'string' ? mood : undefined
  )

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

  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .insert({
      user_id: user.id,
      song_id: song.id,
      type: 'music',
      status: 'pending',
      max_retries: 3,
      payload: {
        prompt: fullPrompt,
        genre: typeof genre === 'string' ? genre : null,
        mood: typeof mood === 'string' ? mood : null,
        mode,
        lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
        language: typeof language === 'string' ? language : null,
      },
    })
    .select()
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: taskError?.message ?? 'Failed to create generation task' } },
      { status: 500 }
    )
  }

  // 同步创建"开始生成"通知
  const { error: notifyError } = await supabase.from('notifications').insert({
    user_id: user.id,
    song_id: song.id,
    type: 'generation',
    subtype: 'started',
    template_key: 'notification.generation.started',
    template_params: { songTitle: song.title },
  })
  if (notifyError) {
    console.error('Failed to create started notification:', notifyError)
  }

  // Fire-and-forget: trigger immediate processing
  triggerGenerationWorker()

  return NextResponse.json(
    { song, task },
    {
      status: 202,
      headers: { 'Retry-After': '10' },
    }
  )
}
