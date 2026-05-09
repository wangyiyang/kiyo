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

  const { id: songId } = await params
  const action = new URL(request.url).searchParams.get('action')

  if (!action || !['generate', 'upload'].includes(action)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing action parameter' } },
      { status: 400 }
    )
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, user_id, title, genre, mood, cover_status')
    .eq('id', songId)
    .single()

  if (songError || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (song.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Song does not belong to you' } },
      { status: 403 }
    )
  }

  if (action === 'generate') {
    await supabase
      .from('songs')
      .update({ cover_status: 'generating' })
      .eq('id', songId)

    try {
      const prompt = buildCoverPrompt('song', {
        title: song.title,
        genre: song.genre,
        mood: song.mood,
      })
      const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

      const imageBuffer = await downloadImage(imageUrl)
      const filePath = `${user.id}/${songId}/${Date.now()}.png`
      const publicUrl = await uploadToCovers(supabase, filePath, imageBuffer)

      const { data: updatedSong, error: updateError } = await supabase
        .from('songs')
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', songId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        coverUrl: publicUrl,
        coverStatus: 'completed',
        song: updatedSong,
      })
    } catch (error) {
      await supabase
        .from('songs')
        .update({ cover_status: 'failed' })
        .eq('id', songId)

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
    const filePath = `${user.id}/${songId}/${Date.now()}.${ext}`
    const publicUrl = await uploadToCovers(supabase, filePath, bytes)

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', songId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverUrl: publicUrl,
      coverStatus: 'completed',
      song: updatedSong,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
