import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Songs stats
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

  // Lyrics stats
  const { count: totalLyrics } = await supabase
    .from('lyrics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: composedLyrics } = await supabase
    .from('songs')
    .select('lyric_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('lyric_id', 'is', null)

  // Albums stats
  const { count: totalAlbums } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

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
      total: totalAlbums ?? 0
    }
  })
}