import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: { song_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { song_ids } = body

  if (!Array.isArray(song_ids) || song_ids.length === 0 || !song_ids.every((id) => typeof id === 'string')) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'song_ids must be a non-empty array of strings' } },
      { status: 400 }
    )
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

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

  const { data: maxRows, error: maxError } = await supabase
    .from('album_songs')
    .select('order_index')
    .eq('album_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)

  if (maxError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: maxError.message } },
      { status: 500 }
    )
  }

  const maxOrderIndex = maxRows?.[0]?.order_index ?? -1

  const albumSongs = song_ids.map((songId, index) => ({
    album_id: params.id,
    song_id: songId,
    order_index: maxOrderIndex + 1 + index,
  }))

  const { error: insertError } = await supabase
    .from('album_songs')
    .insert(albumSongs)

  if (insertError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: insertError.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ added: song_ids.length })
}
