import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createErrorResponse,
  createValidationResponse,
  createForbiddenResponse,
  parseBody,
} from '@/lib/api-utils'

const VALID_BUCKETS = ['audio', 'covers'] as const

async function checkAccess(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  bucket: string,
  path: string,
  userId: string | undefined
): Promise<boolean> {
  if (bucket === 'audio') {
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('file_path', path)
      .single()

    if (song) {
      const isOwner = userId === song.user_id
      const isPublic = song.status === 'completed'
      return isOwner || isPublic
    }
  } else if (bucket === 'covers') {
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('cover_file_path', path)
      .single()

    if (song) {
      const isOwner = userId === song.user_id
      const isPublic = song.status === 'completed'
      return isOwner || isPublic
    }

    const { data: album } = await supabase
      .from('albums')
      .select('id, user_id')
      .eq('cover_file_path', path)
      .single()

    if (album) {
      return userId === album.user_id
    }
  }

  return false
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const body = await parseBody<{ bucket?: string; path?: string }>(request)
  if (body instanceof NextResponse) return body

  const { bucket, path } = body

  if (!bucket || !VALID_BUCKETS.includes(bucket as (typeof VALID_BUCKETS)[number])) {
    return createValidationResponse('Invalid or missing bucket')
  }

  if (!path || typeof path !== 'string' || path.includes('..')) {
    return createValidationResponse('Invalid or missing path')
  }

  const hasAccess = await checkAccess(supabase, bucket, path, user?.id)

  if (!hasAccess) {
    return createForbiddenResponse('Access denied')
  }

  const serviceClient = createServiceRoleClient()
  const { data: signedData, error: signedError } = await serviceClient
    .storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (signedError || !signedData) {
    return createErrorResponse('Failed to generate signed URL')
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  })
}
