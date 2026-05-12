import { createServiceRoleClient } from '@kiyo/supabase/server'
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

export async function GET(request: Request) {
  const supabase = createServiceRoleClient()
  const { page, limit } = parsePaginationParams(request)

  const url = new URL(request.url)
  const genre = url.searchParams.get('genre')
  const mood = url.searchParams.get('mood')

  let query = supabase
    .from('songs')
    .select('*')
    .eq('is_public', true)

  if (genre) {
    query = query.eq('genre', genre)
  }

  if (mood) {
    query = query.eq('mood', mood)
  }

  const { data: songs, error } = await query

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  const allSongs = (songs ?? []) as any[]

  // Memory sort: songs with cover first, then by created_at desc
  allSongs.sort((a, b) => {
    const aHasCover = a.cover_file_path ? 1 : 0
    const bHasCover = b.cover_file_path ? 1 : 0
    if (aHasCover !== bHasCover) {
      return bHasCover - aHasCover
    }
    const aDate = new Date(a.created_at ?? 0).getTime()
    const bDate = new Date(b.created_at ?? 0).getTime()
    return bDate - aDate
  })

  const total = allSongs.length
  const from = (page - 1) * limit
  const to = page * limit
  const paginatedSongs = allSongs.slice(from, to)

  // Batch sign cover_file_path → cover_url
  const serviceClient = createServiceRoleClient()
  await Promise.all(
    paginatedSongs.map(async (song) => {
      if (song.cover_file_path) {
        const { data: signedData } = await serviceClient
          .storage
          .from('covers')
          .createSignedUrl(song.cover_file_path, 3600)
        if (signedData) {
          song.cover_url = signedData.signedUrl
        }
      }
    })
  )

  const hasMore = to < total

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
