import { createServerClient } from '@kiyo/supabase/server'
import { createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const VALID_BUCKETS = ['audio', 'covers'] as const

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: { bucket?: string; path?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { bucket, path } = body

  if (!bucket || !VALID_BUCKETS.includes(bucket as (typeof VALID_BUCKETS)[number])) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing bucket' } },
      { status: 400 }
    )
  }

  if (!path || typeof path !== 'string' || path.includes('..')) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing path' } },
      { status: 400 }
    )
  }

  // Permission check
  let hasAccess = false

  if (bucket === 'audio') {
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('file_path', path)
      .single()

    if (song) {
      const isOwner = user?.id === song.user_id
      const isPublic = song.status === 'completed'
      hasAccess = isOwner || isPublic
    }
  } else if (bucket === 'covers') {
    // Check songs table first
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('cover_file_path', path)
      .single()

    if (song) {
      const isOwner = user?.id === song.user_id
      const isPublic = song.status === 'completed'
      hasAccess = isOwner || isPublic
    } else {
      // Check albums table
      const { data: album } = await supabase
        .from('albums')
        .select('id, user_id')
        .eq('cover_file_path', path)
        .single()

      if (album) {
        hasAccess = user?.id === album.user_id
      }
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    )
  }

  const serviceClient = createServiceRoleClient()
  const { data: signedData, error: signedError } = await serviceClient
    .storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate signed URL' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  })
}
