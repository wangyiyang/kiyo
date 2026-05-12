import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 18
const MAX_LIMIT = 50

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

interface SongRow {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  cover_file_path: string | null
  audio_url: string | null
  file_path: string | null
  duration: number | null
  created_at: string
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { page, limit } = parsePaginationParams(request)

  const url = new URL(request.url)
  const genre = url.searchParams.get('genre') || undefined
  const mood = url.searchParams.get('mood') || undefined

  // 1. Query all public songs through RLS (anonymous client)
  let query = supabase
    .from('songs')
    .select('id, title, genre, mood, cover_url, cover_file_path, audio_url, file_path, duration, created_at')
    .eq('is_public', true)

  if (genre) {
    query = query.eq('genre', genre)
  }
  if (mood) {
    query = query.eq('mood', mood)
  }

  const { data: songs, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  // 2. Memory sort: songs with cover (cover_url OR cover_file_path) first, then created_at desc
  const allSongs: SongRow[] = (songs ?? [])
  allSongs.sort((a, b) => {
    const aHasCover = (a.cover_url || a.cover_file_path) ? 1 : 0
    const bHasCover = (b.cover_url || b.cover_file_path) ? 1 : 0
    if (bHasCover !== aHasCover) {
      return bHasCover - aHasCover
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const total = allSongs.length
  const from = (page - 1) * limit
  const to = page * limit
  const paginatedSongs = allSongs.slice(from, to)

  // 3. Batch sign cover_file_path → cover_url (only if cover_url is empty)
  const songsNeedingSignature = paginatedSongs.filter(
    (s) => s.cover_file_path && !s.cover_url
  )

  if (songsNeedingSignature.length > 0) {
    const serviceClient = createServiceRoleClient()
    await Promise.all(
      songsNeedingSignature.map(async (song) => {
        const { data: signedData } = await serviceClient
          .storage
          .from('covers')
          .createSignedUrl(song.cover_file_path!, 3600)
        if (signedData) {
          song.cover_url = signedData.signedUrl
        }
      })
    )
  }

  const hasMore = from + paginatedSongs.length < total

  return NextResponse.json({
    songs: paginatedSongs,
    pagination: {
      page,
      limit,
      total,
      hasMore,
    },
  })
}
