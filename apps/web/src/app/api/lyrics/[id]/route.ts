import { createServerClient } from '@kiyo/supabase/server'
import type { Database } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 10000
const MAX_FIELD_LENGTH = 100

function validateString(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== 'string') return `${name} must be a string`
  if (value.length === 0) return `${name} is required`
  if (value.length > maxLength) return `${name} must be ${maxLength} characters or less`
  return null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  if (!lyric) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ lyric })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: existing } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
      { status: 404 }
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

  const allowed = ['title', 'content', 'language', 'style', 'mood', 'status']
  const updates: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) {
      if (key === 'title') {
        const error = validateString(body[key], 'Title', MAX_TITLE_LENGTH)
        if (error) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: error } },
            { status: 400 }
          )
        }
        updates[key] = body[key]
      } else if (key === 'content') {
        const error = validateString(body[key], 'Content', MAX_CONTENT_LENGTH)
        if (error) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: error } },
            { status: 400 }
          )
        }
        updates[key] = body[key]
      } else if (typeof body[key] === 'string') {
        const error = validateString(body[key], key, MAX_FIELD_LENGTH)
        if (error) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: error } },
            { status: 400 }
          )
        }
        updates[key] = body[key]
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
      { status: 400 }
    )
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .update(updates as Database['public']['Tables']['lyrics']['Update'])
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ lyric })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: existing } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
      { status: 404 }
    )
  }

  // 检查是否有歌曲关联该歌词
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
          linkedSongCount: linkedCount
        }
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
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
