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

  const rateLimit = await checkRateLimit('task_retry', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  const body = await parseBody<Record<string, unknown>>(request)
  if (body instanceof NextResponse) return body

  const { song_id } = body
  if (!song_id || typeof song_id !== 'string') {
    return createValidationResponse('song_id is required')
  }

  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('song_id', song_id)
    .eq('user_id', user.id)
    .eq('status', 'failed')
    .single()

  if (taskError || !task) {
    return createNotFoundResponse('Failed task')
  }

  const { data: updated, error: updateError } = await supabase
    .from('generation_tasks')
    .update({
      status: 'pending',
      retry_count: 0,
      error_message: null,
      result: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', task.id)
    .select()
    .single()

  if (updateError || !updated) {
    return createErrorResponse(updateError?.message ?? 'Failed to retry task')
  }

  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', song_id)
    .eq('user_id', user.id)

  triggerGenerationWorker()

  return NextResponse.json({ task: updated })
}
