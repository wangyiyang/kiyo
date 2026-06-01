import { createServerClient } from '@kiyo/supabase/server'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { triggerGenerationWorker } from '@/lib/generation-worker'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  parseBody,
} from '@/lib/api-utils'

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
