import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createNotFoundResponse,
  createForbiddenResponse,
  parseBody,
  validateString,
} from '@/lib/api-utils'

const MAX_TITLE_LENGTH = 200

async function fetchAlbum(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  id: string,
  userId: string
) {
  const { data: album, error } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !album) {
    return null
  }
  return album
}

async function fetchAlbumSongs(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  albumId: string
) {
  const { data: albumSongs, error } = await supabase
    .from('album_songs')
    .select('song_id, order_index')
    .eq('album_id', albumId)
    .order('order_index', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const songIds = (albumSongs ?? []).map((as) => as.song_id as string)

  if (songIds.length === 0) {
    return { songIds, songs: [] }
  }

  const { data: songsData, error: songsError } = await supabase
    .from('songs')
    .select('*')
    .in('id', songIds)

  if (songsError) {
    throw new Error(songsError.message)
  }

  const songMap = new Map((songsData ?? []).map((s) => [s.id, s]))
  const songs = songIds.map((id) => songMap.get(id)).filter(Boolean)

  return { songIds, songs }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const album = await fetchAlbum(supabase, params.id, user.id)
  if (!album) {
    return createNotFoundResponse('Album')
  }

  try {
    const { songs } = await fetchAlbumSongs(supabase, params.id)
    return NextResponse.json({ album, songs })
  } catch (err) {
    return createErrorResponse(err instanceof Error ? err.message : 'Failed to fetch songs')
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const album = await fetchAlbum(supabase, params.id, user.id)
  if (!album) {
    return createNotFoundResponse('Album')
  }

  const body = await parseBody<{
    title?: string
    song_ids?: string[]
    is_public?: boolean
  }>(request)
  if (body instanceof NextResponse) return body

  const { title, song_ids, is_public } = body

  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const { data: ownedSongs, error: songsError } = await supabase
      .from('songs')
      .select('id')
      .eq('user_id', user.id)
      .in('id', song_ids)

    if (songsError) {
      return createErrorResponse(songsError.message)
    }

    if (!ownedSongs || ownedSongs.length !== song_ids.length) {
      return createForbiddenResponse('Some songs are not owned by you')
    }
  }

  if (is_public !== undefined) {
    if (typeof is_public !== 'boolean') {
      return createValidationResponse('is_public must be a boolean')
    }

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ is_public })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return createErrorResponse(updateError.message)
    }

    Object.assign(album, updatedAlbum)
  }

  if (title !== undefined) {
    const titleError = validateString(title, 'Title', MAX_TITLE_LENGTH)
    if (titleError) {
      return createValidationResponse(titleError)
    }

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ title })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return createErrorResponse(updateError.message)
    }

    Object.assign(album, updatedAlbum)
  }

  if (song_ids && Array.isArray(song_ids)) {
    await supabase.from('album_songs').delete().eq('album_id', params.id)

    if (song_ids.length > 0) {
      const albumSongs = song_ids.map((songId, index) => ({
        album_id: params.id,
        song_id: songId,
        order_index: index,
      }))

      const { error: insertError } = await supabase.from('album_songs').insert(albumSongs)

      if (insertError) {
        return createErrorResponse(insertError.message)
      }
    }
  }

  return NextResponse.json({ album })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const album = await fetchAlbum(supabase, params.id, user.id)
  if (!album) {
    return createNotFoundResponse('Album')
  }

  const { error: deleteError } = await supabase
    .from('albums')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteError) {
    return createErrorResponse(deleteError.message)
  }

  return NextResponse.json({ success: true })
}
