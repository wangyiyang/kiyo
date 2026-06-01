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

  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )
}
