import { createServerClient } from '@kiyo/supabase/server'
import { captureAppException } from '@/lib/monitoring'
import { triggerGenerationWorker } from '@/lib/generation-worker'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { buildCoverPrompt } from '@/lib/cover'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  createForbiddenResponse,
} from '@/lib/api-utils'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const { id: songId } = await params
  const action = new URL(request.url).searchParams.get('action')

  if (!action || !['generate', 'upload'].includes(action)) {
    return createValidationResponse('Invalid or missing action parameter')
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, user_id, title, genre, mood, cover_status')
    .eq('id', songId)
    .single()

  if (songError || !song) {
    return createNotFoundResponse('Song')
  }

  if (song.user_id !== user.id) {
    return createForbiddenResponse('Song does not belong to you')
  }

  if (action === 'generate') {
    const rateLimit = await checkRateLimit('image_generate', user.id, request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    const { error: statusError } = await supabase
      .from('songs')
      .update({ cover_status: 'generating' })
      .eq('id', songId)

    if (statusError) {
      return createErrorResponse(statusError.message)
    }

    const prompt = buildCoverPrompt('song', {
      title: song.title,
      genre: song.genre,
      mood: song.mood,
    })

    const { data: task, error: taskError } = await supabase
      .from('generation_tasks')
      .insert({
        user_id: user.id,
        song_id: songId,
        type: 'cover',
        status: 'pending',
        max_retries: 3,
        payload: {
          prompt,
          title: song.title,
          genre: song.genre,
          mood: song.mood,
        },
      })
      .select()
      .single()

    if (taskError || !task) {
      await supabase
        .from('songs')
        .update({ cover_status: 'failed' })
        .eq('id', songId)

      captureAppException(taskError ?? new Error('Failed to create generation task'), {
        tags: { area: 'songs', operation: 'cover' },
      })

      return createErrorResponse(taskError?.message ?? 'Failed to create generation task')
    }

    triggerGenerationWorker()

    return NextResponse.json(
      { task, coverStatus: 'generating' },
      {
        status: 202,
        headers: { 'Retry-After': '10' },
      }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return createValidationResponse('No file provided')
    }

    if (!file.type.startsWith('image/')) {
      return createValidationResponse('File must be an image')
    }

    if (file.size > 5 * 1024 * 1024) {
      return createValidationResponse('File size must be less than 5MB')
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type.split('/')[1] || 'png'
    const filePath = `${user.id}/${songId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filePath, bytes, { contentType: file.type })

    if (uploadError) throw new Error(uploadError.message)

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({ cover_file_path: filePath, cover_url: null, cover_status: 'completed' })
      .eq('id', songId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverFilePath: filePath,
      coverStatus: 'completed',
      song: updatedSong,
    })
  } catch (error) {
    captureAppException(error, {
      tags: { area: 'songs', operation: 'cover' },
    })
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return createErrorResponse(errorMessage)
  }
}
