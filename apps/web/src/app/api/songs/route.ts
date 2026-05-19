import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import { createUnauthorizedResponse, createErrorResponse, parsePagination } from '@/lib/api-utils'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const url = new URL(request.url)
  const { page, limit, offset } = parsePagination(url.searchParams)

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return createErrorResponse(error.message)
  }

  const { count: total, error: countError } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    return createErrorResponse(countError.message)
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
