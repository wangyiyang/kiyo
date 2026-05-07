import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
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

  const { data: albumSongs, error: albumSongsError } = await supabase
    .from('album_songs')
    .select('song_id, order_index')
    .eq('album_id', params.id)
    .order('order_index', { ascending: true })

  if (albumSongsError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: albumSongsError.message } },
      { status: 500 }
    )
  }

  const songIds = (albumSongs ?? []).map((as: any) => as.song_id)

  let songs: any[] = []
  if (songIds.length > 0) {
    const { data: songsData, error: songsError } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .in('id', songIds)

    if (songsError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: songsError.message } },
        { status: 500 }
      )
    }

    const songMap = new Map((songsData ?? []).map((s: any) => [s.id, s]))
    songs = songIds.map((id: string) => songMap.get(id)).filter(Boolean)
  }

  return NextResponse.json({ album, songs })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
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

  if (title !== undefined) {
    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ title })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    Object.assign(album, updatedAlbum)
  }

  if (song_ids && Array.isArray(song_ids)) {
    await supabase
      .from('album_songs')
      .delete()
      .eq('album_id', params.id)

    if (song_ids.length > 0) {
      const albumSongs = song_ids.map((songId, index) => ({
        album_id: params.id,
        song_id: songId,
        order_index: index,
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
    }
  }

  return NextResponse.json({ album })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
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

  const { error: deleteError } = await supabase
    .from('albums')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (deleteError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: deleteError.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
