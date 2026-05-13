import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { captureAppException } from '@/lib/monitoring'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import { NextResponse } from 'next/server'
import { buildCoverPrompt } from '@/lib/cover'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { id: albumId } = await params
  const action = new URL(request.url).searchParams.get('action')

  if (!action || !['generate', 'upload'].includes(action)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing action parameter' } },
      { status: 400 }
    )
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, user_id, title, description, cover_status')
    .eq('id', albumId)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  if (album.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Album does not belong to you' } },
      { status: 403 }
    )
  }

  if (action === 'generate') {
    // Rate limiting for AI cover generation
    const rateLimit = await checkRateLimit('image_generate', user.id, request)
    if (!rateLimit.allowed) {
      return createRateLimitResponse(rateLimit)
    }

    // Set cover_status to generating immediately
    const { error: statusError } = await supabase
      .from('albums')
      .update({ cover_status: 'generating' })
      .eq('id', albumId)

    if (statusError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: statusError.message } },
        { status: 500 }
      )
    }

    const prompt = buildCoverPrompt('album', {
      title: album.title,
      description: album.description,
    })

    // Create async generation task
    const { data: task, error: taskError } = await supabase
      .from('generation_tasks')
      .insert({
        user_id: user.id,
        album_id: albumId,
        type: 'album_cover',
        status: 'pending',
        max_retries: 3,
        payload: {
          prompt,
          title: album.title,
          description: album.description,
        },
      })
      .select()
      .single()

    if (taskError || !task) {
      // Rollback cover_status on task creation failure
      await supabase
        .from('albums')
        .update({ cover_status: 'failed' })
        .eq('id', albumId)

      captureAppException(taskError ?? new Error('Failed to create generation task'), {
        tags: { area: 'albums', operation: 'cover' },
      })

      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: taskError?.message ?? 'Failed to create generation task' } },
        { status: 500 }
      )
    }

    // Fire-and-forget: trigger immediate processing
    void createServiceRoleClient()
      .functions.invoke('process-generation-task')
      .catch((err) => {
        console.error('Failed to trigger generation worker:', err)
      })

    return NextResponse.json(
      { task, coverStatus: 'generating' },
      {
        status: 202,
        headers: { 'Retry-After': '10' },
      }
    )
  }

  // action === 'upload'
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File must be an image' } },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File size must be less than 5MB' } },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type.split('/')[1] || 'png'
    const filePath = `${user.id}/${albumId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filePath, bytes, { contentType: file.type })

    if (uploadError) throw new Error(uploadError.message)

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ cover_file_path: filePath, cover_url: null, cover_status: 'completed' })
      .eq('id', albumId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverFilePath: filePath,
      coverStatus: 'completed',
      album: updatedAlbum,
    })
  } catch (error) {
    captureAppException(error, {
      tags: { area: 'albums', operation: 'cover' },
    })
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
