import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  parseBody,
  validateString,
  parsePagination,
} from '@/lib/api-utils'

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 10000
const MAX_FIELD_LENGTH = 100

function validateLyricField(key: string, value: unknown): string | null {
  switch (key) {
    case 'title':
      return validateString(value, 'Title', MAX_TITLE_LENGTH)
    case 'content':
      return validateString(value, 'Content', MAX_CONTENT_LENGTH)
    case 'language':
    case 'style':
    case 'mood':
      return validateString(value, key, MAX_FIELD_LENGTH)
    default:
      return null
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const body = await parseBody<{
    title?: string
    content?: string
    language?: string
    style?: string
    mood?: string
  }>(request)
  if (body instanceof NextResponse) return body

  const titleError = validateLyricField('title', body.title)
  if (titleError) return createValidationResponse(titleError)

  const contentError = validateLyricField('content', body.content)
  if (contentError) return createValidationResponse(contentError)

  const optionalFields = ['language', 'style', 'mood'] as const
  for (const field of optionalFields) {
    const value = body[field]
    if (value) {
      const error = validateLyricField(field, value)
      if (error) return createValidationResponse(error)
    }
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .insert({
      title: body.title!,
      content: body.content!,
      language: body.language ?? null,
      style: body.style ?? null,
      mood: body.mood ?? null,
      source: 'manual',
      status: 'draft',
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return createErrorResponse(error.message)
  }

  return NextResponse.json({ lyric })
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const url = new URL(request.url)
  const { page, limit, offset } = parsePagination(url.searchParams)

  const { data: lyrics, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return createErrorResponse(error.message)
  }

  const { count: total, error: countError } = await supabase
    .from('lyrics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return createErrorResponse(countError.message)
  }

  const totalCount = total ?? 0

  return NextResponse.json({
    lyrics: lyrics ?? [],
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  })
}
