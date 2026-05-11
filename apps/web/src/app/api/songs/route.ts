import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const MAX_TITLE_LENGTH = 200
const MAX_FIELD_LENGTH = 100
const MAX_AI_PROMPT_LENGTH = 2000

function validateString(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== 'string') return `${name} must be a string`
  if (value.length === 0) return `${name} is required`
  if (value.length > maxLength) return `${name} must be ${maxLength} characters or less`
  return null
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function parsePaginationParams(request: Request): { page: number; limit: number } {
  const url = new URL(request.url)
  const rawPage = url.searchParams.get('page')
  const rawLimit = url.searchParams.get('limit')

  let page = parseInt(rawPage ?? '', 10)
  let limit = parseInt(rawLimit ?? '', 10)

  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  return { page, limit }
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { page, limit } = parsePaginationParams(request)
  const from = (page - 1) * limit
  const to = page * limit - 1

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const { count: total, error: countError } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: countError.message } },
      { status: 500 }
    )
  }

  const totalCount = total ?? 0

  return NextResponse.json({
    songs: songs ?? [],
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  })
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

  const titleRaw = body.title as string | undefined
  const titleError = validateString(titleRaw, 'Title', MAX_TITLE_LENGTH)
  if (titleError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: titleError } },
      { status: 400 }
    )
  }

  const genreRaw = body.genre as string | undefined
  if (genreRaw) {
    const genreError = validateString(genreRaw, 'Genre', MAX_FIELD_LENGTH)
    if (genreError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: genreError } },
        { status: 400 }
      )
    }
  }
  const moodRaw = body.mood as string | undefined
  if (moodRaw) {
    const moodError = validateString(moodRaw, 'Mood', MAX_FIELD_LENGTH)
    if (moodError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: moodError } },
        { status: 400 }
      )
    }
  }
  const aiPromptRaw = body.ai_prompt as string | undefined
  if (aiPromptRaw) {
    const promptError = validateString(aiPromptRaw, 'AI Prompt', MAX_AI_PROMPT_LENGTH)
    if (promptError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: promptError } },
        { status: 400 }
      )
    }
  }

  const { data: song, error } = await supabase
    .from('songs')
    .insert({
      title: titleRaw!.trim(),
      lyric_id: typeof body.lyric_id === 'string' ? body.lyric_id : null,
      genre: genreRaw ?? null,
      mood: moodRaw ?? null,
      ai_prompt: aiPromptRaw ?? null,
      status: 'draft',
      source: 'manual',
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ song })
}
