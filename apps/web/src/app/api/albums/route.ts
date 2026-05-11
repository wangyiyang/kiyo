import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000

function validateString(value: unknown, name: string, maxLength: number): string | null {
  if (typeof value !== 'string') return `${name} must be a string`
  if (value.length === 0) return `${name} is required`
  if (value.length > maxLength) return `${name} must be ${maxLength} characters or less`
  return null
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: { title?: string; song_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { title, song_ids } = body

  const titleError = validateString(title, 'Title', MAX_TITLE_LENGTH)
  if (titleError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: titleError } },
      { status: 400 }
    )
  }

  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const { data: ownedSongs, error: songsError } = await supabase
      .from('songs')
      .select('id')
      .eq('user_id', user.id)
      .in('id', song_ids)

    if (songsError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: songsError.message } },
        { status: 500 }
      )
    }

    if (!ownedSongs || ownedSongs.length !== song_ids.length) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Some songs are not owned by you' } },
        { status: 403 }
      )
    }
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({ title, user_id: user.id })
    .select()
    .single()

  if (albumError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: albumError.message } },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: albumSongsError.message } },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ album })
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function parsePaginationParams(request: Request): { page: number; limit: number } {
  const url = new URL(request.url)
  const rawPage = url.searchParams.get('page')
  const rawLimit = url.searchParams.get('limit')

  let page = parseInt(rawPage ?? '', 10)
  let limit = parseInt(rawLimit ?? '', 10)

  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  return { page, limit }
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { page, limit } = parsePaginationParams(request)
  const from = (page - 1) * limit
  const to = page * limit - 1

  const { data: albums, error } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const { count: total, error: countError } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: countError.message } },
      { status: 500 }
    )
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
