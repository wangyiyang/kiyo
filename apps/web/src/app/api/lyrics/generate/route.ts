import { createServerClient } from '@kiyo/supabase'
import { generateLyrics } from '@kiyo/ai'
import { NextResponse } from 'next/server'

function buildLyricsPrompt(params: {
  prompt: string
  language?: string
  style?: string
  mood?: string
}): string {
  const parts = [params.prompt]
  if (params.language) parts.push(`语言：${params.language}`)
  if (params.style) parts.push(`风格：${params.style}`)
  if (params.mood) parts.push(`情绪：${params.mood}`)
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

  let body: {
    prompt?: string
    language?: string
    style?: string
    mood?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { prompt, language, style, mood } = body
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } },
      { status: 400 }
    )
  }

  try {
    const fullPrompt = buildLyricsPrompt({ prompt, language, style, mood })
    const { text } = await generateLyrics({ prompt: fullPrompt })

    const title = prompt.slice(0, 50)

    const { data: lyric, error } = await supabase
      .from('lyrics')
      .insert({
        title,
        content: text,
        language: language ?? null,
        style: style ?? null,
        mood: mood ?? null,
        source: 'ai_generated',
        status: 'draft',
        ai_prompt: prompt,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lyrics generation failed'
    const statusCode = message.includes('Minimax') || message.includes('generation') ? 422 : 500
    return NextResponse.json(
      {
        error: {
          code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: statusCode }
    )
  }
}
