import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ songs: songs ?? [] })
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

  const { title, lyric_id, genre, mood, ai_prompt } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .insert({
      title: title.trim(),
      lyric_id: typeof lyric_id === 'string' ? lyric_id : null,
      genre: typeof genre === 'string' ? genre : null,
      mood: typeof mood === 'string' ? mood : null,
      ai_prompt: typeof ai_prompt === 'string' ? ai_prompt : null,
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
