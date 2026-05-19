import { createServerClient } from '@kiyo/supabase/server'
import type { Database } from '@kiyo/supabase'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  parseBody,
  validateString,
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
      return typeof value === 'string' ? validateString(value, key, MAX_FIELD_LENGTH) : null
    default:
      return null
  }
}

async function fetchLyric(supabase: Awaited<ReturnType<typeof createServerClient>>, id: string, userId: string): Promise<{ lyric: unknown } | null> {
  const { data: lyric, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !lyric) {
    return null
  }
  return { lyric }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const result = await fetchLyric(supabase, params.id, user.id)
  if (!result) {
    return createNotFoundResponse('Lyric')
  }

  return NextResponse.json({ lyric: result.lyric })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const existingResult = await fetchLyric(supabase, params.id, user.id)
  if (!existingResult) {
    return createNotFoundResponse('Lyric')
  }

  const body = await parseBody<Record<string, unknown>>(request)
  if (body instanceof NextResponse) return body

  const allowed = ['title', 'content', 'language', 'style', 'mood', 'status']
  const updates: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) {
      const error = validateLyricField(key, body[key])
      if (error) {
        return createValidationResponse(error)
      }
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return createValidationResponse('No valid fields to update')
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .update(updates as Database['public']['Tables']['lyrics']['Update'])
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return createErrorResponse(error.message)
  }

  return NextResponse.json({ lyric })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const existingResult = await fetchLyric(supabase, params.id, user.id)
  if (!existingResult) {
    return createNotFoundResponse('Lyric')
  }

  const { count: linkedCount } = await supabase
    .from('songs')
    .select('id', { count: 'exact' })
    .eq('lyric_id', params.id)

  if (linkedCount && linkedCount > 0) {
    return NextResponse.json(
      {
        error: {
          code: 'LYRIC_IN_USE',
          message: `该歌词已被 ${linkedCount} 首歌曲使用，请先解除关联或删除相关歌曲。`,
          linkedSongCount: linkedCount,
        },
      },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('lyrics')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return createErrorResponse(error.message)
  }

  return NextResponse.json({ success: true })
}
