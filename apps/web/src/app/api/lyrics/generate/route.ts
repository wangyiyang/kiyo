import { createServerClient } from '@kiyo/supabase/server'
import { generateLyrics, routeLyrics, ProviderError, MinimaxError } from '@kiyo/ai'
import { captureAppException } from '@/lib/monitoring'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { buildLyricsPrompt } from './lib'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )
}
