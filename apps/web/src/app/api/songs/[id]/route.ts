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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ song })
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
    .from('songs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
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

  const protectedFields = ['audio_url', 'status', 'duration']
  for (const field of protectedFields) {
    if (field in body) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `Cannot update ${field} directly` } },
        { status: 400 }
      )
    }
  }

  const allowed = ['title', 'lyric_id', 'genre', 'mood', 'ai_prompt', 'cover_url', 'is_public']
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
      } else if (key === 'ai_prompt') {
        const error = validateString(body[key], 'AI Prompt', MAX_AI_PROMPT_LENGTH)
        if (error) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: error } },
            { status: 400 }
          )
        }
        updates[key] = body[key]
      } else if (key === 'is_public') {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'is_public must be a boolean' } },
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
      } else if (body[key] === null) {
        updates[key] = null
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
      { status: 400 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .update(updates)
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

  return NextResponse.json({ song })
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
    .from('songs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  const storagePath = existing.file_path || (() => {
    try {
      const url = new URL(existing.audio_url)
      const pathParts = url.pathname.split('/')
      return pathParts.slice(pathParts.indexOf('audio') + 1).join('/')
    } catch {
      return null
    }
  })()

  if (storagePath) {
    await supabase.storage.from('audio').remove([storagePath])
  }

  const { error } = await supabase
    .from('songs')
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
