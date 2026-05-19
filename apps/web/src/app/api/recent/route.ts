import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import { createUnauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7')
  const limit = parseInt(searchParams.get('limit') ?? '6')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return createUnauthorizedResponse()
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  const { data: recentSongs } = await supabase
    .from('songs')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  const { data: recentLyrics } = await supabase
    .from('lyrics')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  const { data: recentAlbums } = await supabase
    .from('albums')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  const items = [
    ...(recentSongs ?? []).map(s => ({ type: 'song' as const, ...s })),
    ...(recentLyrics ?? []).map(l => ({ type: 'lyric' as const, ...l })),
    ...(recentAlbums ?? []).map(a => ({ type: 'album' as const, ...a }))
  ]
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      return bTime - aTime
    })
    .slice(0, limit)

  return NextResponse.json({ items })
}
