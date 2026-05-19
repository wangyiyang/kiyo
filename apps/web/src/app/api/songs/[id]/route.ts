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
const MAX_FIELD_LENGTH = 100
const MAX_AI_PROMPT_LENGTH = 2000

function validateSongField(key: string, value: unknown): string | null {
  switch (key) {
    case 'title':
      return validateString(value, 'Title', MAX_TITLE_LENGTH)
    case 'ai_prompt':
      return validateString(value, 'AI Prompt', MAX_AI_PROMPT_LENGTH)
    case 'genre':
    case 'mood':
      return typeof value === 'string' ? validateString(value, key, MAX_FIELD_LENGTH) : null
    default:
      return null
  }
}

async function fetchSong(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  id: string,
  userId: string
) {
  const { data: song, error } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !song) {
    return null
  }
  return song
}

function extractStoragePath(audioUrl: string | null): string | null {
  if (!audioUrl) return null
  try {
    const url = new URL(audioUrl)
    const pathParts = url.pathname.split('/')
    return pathParts.slice(pathParts.indexOf('audio') + 1).join('/')
  } catch {
    return null
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const song = await fetchSong(supabase, params.id, user.id)
  if (!song) {
    return createNotFoundResponse('Song')
  }

  return NextResponse.json({ song })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const existing = await fetchSong(supabase, params.id, user.id)
  if (!existing) {
    return createNotFoundResponse('Song')
  }

  const body = await parseBody<Record<string, unknown>>(request)
  if (body instanceof NextResponse) return body

  const protectedFields = ['audio_url', 'status', 'duration']
  for (const field of protectedFields) {
    if (field in body) {
      return createValidationResponse(`Cannot update ${field} directly`)
    }
  }

  const allowed = ['title', 'lyric_id', 'genre', 'mood', 'ai_prompt', 'cover_url', 'is_public']
  const updates: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) {
      if (key === 'is_public') {
        if (typeof body[key] !== 'boolean') {
          return createValidationResponse('is_public must be a boolean')
        }
        updates[key] = body[key]
      } else if (body[key] === null) {
        updates[key] = null
      } else {
        const error = validateSongField(key, body[key])
        if (error) {
          return createValidationResponse(error)
        }
        updates[key] = body[key]
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return createValidationResponse('No valid fields to update')
  }

  const { data: song, error } = await supabase
    .from('songs')
    .update(updates as Database['public']['Tables']['songs']['Update'])
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return createErrorResponse(error.message)
  }

  return NextResponse.json({ song })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const existing = await fetchSong(supabase, params.id, user.id)
  if (!existing) {
    return createNotFoundResponse('Song')
  }

  const storagePath = existing.file_path || extractStoragePath(existing.audio_url)

  if (storagePath) {
    await supabase.storage.from('audio').remove([storagePath])
  }

  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return createErrorResponse(error.message)
  }

  return NextResponse.json({ success: true })
}
