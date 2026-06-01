import { createServerClient } from '@kiyo/supabase/server'
import { captureAppException } from '@/lib/monitoring'
import { generateMusic, MinimaxError } from '@kiyo/ai'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createValidationResponse,
  createNotFoundResponse,
} from '@/lib/api-utils'

export async function POST(request: Request, { params }: { params: { id: string } }) {
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
