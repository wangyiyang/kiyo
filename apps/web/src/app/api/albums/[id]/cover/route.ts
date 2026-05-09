import { createServerClient } from '@kiyo/supabase/server'
import { generateImage } from '@kiyo/ai'
import { NextResponse } from 'next/server'
import { buildCoverPrompt, downloadImage, uploadToCovers } from '@/lib/cover'

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
    await supabase
      .from('albums')
      .update({ cover_status: 'generating' })
      .eq('id', albumId)

    try {
      const prompt = buildCoverPrompt('album', {
        title: album.title,
        description: album.description,
      })
      const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

      const imageBuffer = await downloadImage(imageUrl)
      const filePath = `${user.id}/${albumId}/${Date.now()}.png`
      const publicUrl = await uploadToCovers(supabase, filePath, imageBuffer)

      const { data: updatedAlbum, error: updateError } = await supabase
        .from('albums')
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', albumId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        coverUrl: publicUrl,
        coverStatus: 'completed',
        album: updatedAlbum,
      })
    } catch (error) {
      await supabase
        .from('albums')
        .update({ cover_status: 'failed' })
        .eq('id', albumId)

      const errorMessage = error instanceof Error ? error.message : 'Cover generation failed'
      const statusCode = errorMessage.includes('Minimax') || errorMessage.includes('generation') ? 422 : 500

      return NextResponse.json(
        { error: { code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR', message: errorMessage }, coverStatus: 'failed' },
        { status: statusCode }
      )
    }
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
    const publicUrl = await uploadToCovers(supabase, filePath, bytes)

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', albumId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverUrl: publicUrl,
      coverStatus: 'completed',
      album: updatedAlbum,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
