import { createServerClient } from '@kiyo/supabase'
import { generateImage } from '@kiyo/ai'
import { NextResponse } from 'next/server'

function buildCoverPrompt(title: string, description: string | null): string {
  if (description) {
    return `专辑: ${title}。${description}`
  }
  return `专辑: ${title}`
}

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

  await supabase
    .from('albums')
    .update({ cover_status: 'generating' })
    .eq('id', albumId)

  try {
    const prompt = buildCoverPrompt(album.title, album.description)
    const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image')
    }
    const imageBuffer = await imageResponse.arrayBuffer()

    const filePath = `${user.id}/${albumId}/${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filePath, imageBuffer, { contentType: 'image/png' })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', albumId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

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
