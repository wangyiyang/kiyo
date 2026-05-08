import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: { title?: string; content?: string; language?: string; style?: string; mood?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { title, content, language, style, mood } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }
  if (!content || typeof content !== 'string' || content.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Content is required' } },
      { status: 400 }
    )
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .insert({
      title,
      content,
      language: typeof language === 'string' ? language : null,
      style: typeof style === 'string' ? style : null,
      mood: typeof mood === 'string' ? mood : null,
      source: 'manual',
      status: 'draft',
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

  return NextResponse.json({ lyric })
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: lyrics, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ lyrics: lyrics ?? [] })
}
