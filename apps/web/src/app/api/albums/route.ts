import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createForbiddenResponse,
  parseBody,
  validateString,
  parsePagination,
} from '@/lib/api-utils'

const MAX_TITLE_LENGTH = 200

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const body = await parseBody<{ title?: string; song_ids?: string[] }>(request)
  if (body instanceof NextResponse) return body

  const { title, song_ids } = body

  const titleError = validateString(title, 'Title', MAX_TITLE_LENGTH)
  if (titleError) {
    return createValidationResponse(titleError)
  }

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

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({ title: title!, user_id: user.id })
    .select()
    .single()

  if (albumError) {
    return createErrorResponse(albumError.message)
  }

  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const albumSongs = song_ids.map((songId, index) => ({
      album_id: album.id,
      song_id: songId,
      order_index: index,
    }))

    const { error: albumSongsError } = await supabase
      .from('album_songs')
      .insert(albumSongs)

    if (albumSongsError) {
      return createErrorResponse(albumSongsError.message)
    }
  }

  return NextResponse.json({ album })
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const url = new URL(request.url)
  const { page, limit, offset } = parsePagination(url.searchParams)

  const { data: albums, error } = await supabase
    .from('albums')
    .select('*, album_songs(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return createErrorResponse(error.message)
  }

  const { count: total, error: countError } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return createErrorResponse(countError.message)
  }

  const totalCount = total ?? 0

  return NextResponse.json({
    albums: albums ?? [],
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  })
}
