import { createServerClient } from '@kiyo/supabase/server'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
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

  // Rate limiting
  const rateLimit = await checkRateLimit('task_retry', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
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

  const { song_id } = body
  if (!song_id || typeof song_id !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'song_id is required' } },
      { status: 400 }
    )
  }

  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('song_id', song_id)
    .eq('user_id', user.id)
    .eq('status', 'failed')
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'No failed task found for this song' } },
      { status: 404 }
    )
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
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: updateError?.message ?? 'Failed to retry task' } },
      { status: 500 }
    )
  }

  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', song_id)
    .eq('user_id', user.id)

  return NextResponse.json({ task: updated })
}
