import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  createForbiddenResponse,
  parseBody,
} from '@/lib/api-utils'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const body = await parseBody<{ song_ids?: string[] }>(request)
  if (body instanceof NextResponse) return body

  const { song_ids } = body

  if (!Array.isArray(song_ids) || song_ids.length === 0 || !song_ids.every((id) => typeof id === 'string')) {
    return createValidationResponse('song_ids must be a non-empty array of strings')
  }

  const uniqueSongIds = Array.from(new Set(song_ids))

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (albumError || !album) {
    return createNotFoundResponse('Album')
  }

  const { data: ownedSongs, error: songsError } = await supabase
    .from('songs')
    .select('id')
    .eq('user_id', user.id)
    .in('id', uniqueSongIds)

  if (songsError) {
    return createErrorResponse(songsError.message)
  }

  if (!ownedSongs || ownedSongs.length !== uniqueSongIds.length) {
    return createForbiddenResponse('Some songs are not owned by you')
  }

  const { data: existingAlbumSongs, error: existingError } = await supabase
    .from('album_songs')
    .select('song_id')
    .eq('album_id', params.id)
    .in('song_id', uniqueSongIds)

  if (existingError) {
    return createErrorResponse(existingError.message)
  }

  if (existingAlbumSongs && existingAlbumSongs.length > 0) {
    return createValidationResponse('Some songs are already in this album')
  }

  const { data: maxRows, error: maxError } = await supabase
    .from('album_songs')
    .select('order_index')
    .eq('album_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)

  if (maxError) {
    return createErrorResponse(maxError.message)
  }

  const maxOrderIndex = maxRows?.[0]?.order_index ?? -1

  const albumSongs = uniqueSongIds.map((songId, index) => ({
    album_id: params.id,
    song_id: songId,
    order_index: maxOrderIndex + 1 + index,
  }))

  const { error: insertError } = await supabase
    .from('album_songs')
    .insert(albumSongs)

  if (insertError) {
    return createErrorResponse(insertError.message)
  }

  return NextResponse.json({ added: uniqueSongIds.length })
}
