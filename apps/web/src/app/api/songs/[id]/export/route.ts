import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createNotFoundResponse,
  createBadRequestResponse,
} from '@/lib/api-utils'

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
    return createUnauthorizedResponse()
  }

  const { data: song, error } = await supabase
    .from('songs')
    .select('id, title, status, file_path, audio_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !song) {
    return createNotFoundResponse('Song')
  }

  if (song.status !== 'completed') {
    return createBadRequestResponse('Song is not completed yet')
  }

  const filePath = song.file_path || parseFilePathFromUrl(song.audio_url || '')

  if (!filePath) {
    return createBadRequestResponse('No audio file available')
  }

  const { data: signedData, error: signedError } = await supabase
    .storage
    .from('audio')
    .createSignedUrl(filePath, 300)

  if (signedError || !signedData) {
    return createErrorResponse('Failed to generate download link')
  }

  const filename = `${sanitizeFilename(song.title)}.mp3`

  return NextResponse.json({
    downloadUrl: signedData.signedUrl,
    filename,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  })
}
