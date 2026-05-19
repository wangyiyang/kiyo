import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import { createUnauthorizedResponse } from '@/lib/api-utils'

export async function GET() {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return createUnauthorizedResponse()
  }

  const { count: totalSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: completedSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const { count: generatingSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'generating')

  const { count: totalLyrics } = await supabase
    .from('lyrics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: composedLyrics } = await supabase
    .from('songs')
    .select('lyric_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('lyric_id', 'is', null)

  const { count: totalAlbums } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data: albumsWithSongCounts } = await supabase
    .from('albums')
    .select('album_songs(count)')
    .eq('user_id', user.id)

  const totalAlbumSongs = (albumsWithSongCounts ?? []).reduce(
    (sum, a) => sum + (a.album_songs?.[0]?.count ?? 0),
    0
  )

  return NextResponse.json({
    songs: {
      total: totalSongs ?? 0,
      completed: completedSongs ?? 0,
      generating: generatingSongs ?? 0
    },
    lyrics: {
      total: totalLyrics ?? 0,
      composed: composedLyrics ?? 0
    },
    albums: {
      total: totalAlbums ?? 0,
      totalSongs: totalAlbumSongs
    }
  })
}
