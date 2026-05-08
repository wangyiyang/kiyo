import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

function parseFilePathFromUrl(audioUrl: string): string | null {
  try {
    const url = new URL(audioUrl)
    const pathParts = url.pathname.split('/')
    const audioIndex = pathParts.indexOf('audio')
    if (audioIndex === -1) return null
    return pathParts.slice(audioIndex + 1).join('/')
  } catch {
    return null
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .select('id, title, status, file_path, audio_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (song.status !== 'completed') {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Song is not completed yet' } },
      { status: 400 }
    )
  }

  const filePath = song.file_path || parseFilePathFromUrl(song.audio_url || '')

  if (!filePath) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'No audio file available' } },
      { status: 400 }
    )
  }

  const { data: signedData, error: signedError } = await supabase
    .storage
    .from('audio')
    .createSignedUrl(filePath, 300) // 5 minutes

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate download link' } },
      { status: 500 }
    )
  }

  const filename = `${sanitizeFilename(song.title)}.mp3`

  return NextResponse.json({
    downloadUrl: signedData.signedUrl,
    filename,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  })
}
