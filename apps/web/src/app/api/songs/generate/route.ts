import { createServerClient } from '@kiyo/supabase/server'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { triggerGenerationWorker } from '@/lib/generation-worker'
import { normalizeTag } from '@/lib/tag-normalization'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  createForbiddenResponse,
  parseBody,
} from '@/lib/api-utils'

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
    return createUnauthorizedResponse()
  }

  const rateLimit = await checkRateLimit('song_generate', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  const body = await parseBody<Record<string, unknown>>(request)
  if (body instanceof NextResponse) return body

  const { prompt, mode, genre, mood, language, lyric_id, title } = body

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return createValidationResponse('Prompt is required')
  }

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return createValidationResponse('Title is required')
  }

  if (!VALID_MODES.includes(mode as Mode)) {
    return createValidationResponse('Invalid mode')
  }

  if (mode === 'existing_lyric') {
    if (!lyric_id || typeof lyric_id !== 'string') {
      return createValidationResponse('lyric_id is required for existing_lyric mode')
    }

    const { data: lyric, error: lyricError } = await supabase
      .from('lyrics')
      .select('id, user_id, content')
      .eq('id', lyric_id)
      .single()

    if (lyricError || !lyric) {
      return createNotFoundResponse('Lyric')
    }

    if (lyric.user_id !== user.id) {
      return createForbiddenResponse('You do not have permission to use this lyric')
    }
  }

  const normalizedGenre = normalizeTag(typeof genre === 'string' ? genre : null)
  const normalizedMood = normalizeTag(typeof mood === 'string' ? mood : null)

  const fullPrompt = buildPrompt(
    prompt.trim(),
    typeof language === 'string' ? language : undefined,
    typeof genre === 'string' ? genre : undefined,
    typeof mood === 'string' ? mood : undefined
  )

  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: title.trim().slice(0, 100),
      lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
      genre: normalizedGenre,
      mood: normalizedMood,
      ai_prompt: fullPrompt,
      status: 'generating',
      source: 'ai_generated',
      user_id: user.id,
    })
    .select()
    .single()

  if (insertError || !song) {
    return createErrorResponse(insertError?.message ?? 'Failed to create song')
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
        genre: normalizedGenre,
        mood: normalizedMood,
        mode: mode as string,
        lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
        language: typeof language === 'string' ? language : null,
      },
    })
    .select()
    .single()

  if (taskError || !task) {
    return createErrorResponse(taskError?.message ?? 'Failed to create generation task')
  }

  await supabase.from('notifications').insert({
    user_id: user.id,
    song_id: song.id,
    type: 'generation',
    subtype: 'started',
    template_key: 'notification.generation.started',
    template_params: { songTitle: song.title },
  })

  triggerGenerationWorker()

  return NextResponse.json(
    { song, task },
    {
      status: 202,
      headers: { 'Retry-After': '10' },
    }
  )
}
