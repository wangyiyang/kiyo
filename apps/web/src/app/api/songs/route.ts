import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

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

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
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
    .from('songs')
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
    songs: songs ?? [],
    pagination: {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
    },
  })
}
