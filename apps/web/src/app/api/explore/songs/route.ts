import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import { createErrorResponse, parsePagination } from '@/lib/api-utils'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 18
const MAX_LIMIT = 50

function normalizeSearchParam(value: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase()
  return normalized || undefined
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
  created_at: string | null
}

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const url = new URL(request.url)
  const { page, limit, offset } = parsePagination(url.searchParams, {
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
    maxLimit: MAX_LIMIT,
  })

  const genre = url.searchParams.get('genre') || undefined
  const mood = url.searchParams.get('mood') || undefined
  const search = normalizeSearchParam(url.searchParams.get('q'))

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
    return createErrorResponse(error.message)
  }

  const allSongs: SongRow[] = (songs ?? []).filter((song) => {
    if (!search) return true
    return song.title.toLowerCase().includes(search)
  })

  allSongs.sort((a, b) => {
    const aHasCover = (a.cover_url || a.cover_file_path) ? 1 : 0
    const bHasCover = (b.cover_url || b.cover_file_path) ? 1 : 0
    if (bHasCover !== aHasCover) {
      return bHasCover - aHasCover
    }
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    return bTime - aTime
  })

  const total = allSongs.length
  const from = offset
  const to = page * limit
  const paginatedSongs = allSongs.slice(from, to)

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
