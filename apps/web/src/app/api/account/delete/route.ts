import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'
import {
  createUnauthorizedResponse,
  createErrorResponse,
  createValidationResponse,
  createPasswordIncorrectResponse,
  parseBody,
} from '@/lib/api-utils'

interface DeleteAccountBody {
  confirmation: string
  password: string
}

function extractCoverPath(coverUrl: string): string | null {
  try {
    const url = new URL(coverUrl)
    const pathParts = url.pathname.split('/')
    const filePath = pathParts.slice(pathParts.indexOf('covers') + 1).join('/')
    return filePath || null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return createUnauthorizedResponse()
  }

  const body = await parseBody<DeleteAccountBody>(request)
  if (body instanceof NextResponse) return body

  if (body.confirmation !== 'DELETE') {
    return createValidationResponse('Confirmation must be "DELETE"')
  }

  if (!body.password || typeof body.password !== 'string') {
    return createValidationResponse('Password is required')
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.password,
  })

  if (signInError) {
    if (signInError.code === 'invalid_credentials') {
      return createPasswordIncorrectResponse('Current password is incorrect')
    }
    return createErrorResponse('Password verification failed', 403)
  }

  const serviceClient = createServiceRoleClient()

  const songsResult = await serviceClient.from('songs').select('file_path, cover_url').eq('user_id', user.id)
  const albumsResult = await serviceClient.from('albums').select('cover_url').eq('user_id', user.id)

  const storagePaths: { bucket: string; path: string }[] = []

  if (songsResult.data) {
    for (const song of songsResult.data) {
      if (song.file_path) {
        storagePaths.push({ bucket: 'audio', path: song.file_path })
      }
      const coverPath = song.cover_url ? extractCoverPath(song.cover_url) : null
      if (coverPath) storagePaths.push({ bucket: 'covers', path: coverPath })
    }
  }

  if (albumsResult.data) {
    for (const album of albumsResult.data) {
      const coverPath = album.cover_url ? extractCoverPath(album.cover_url) : null
      if (coverPath) storagePaths.push({ bucket: 'covers', path: coverPath })
    }
  }

  const { error: rpcError } = await serviceClient.rpc('delete_user_data', {
    target_user_id: user.id,
  })

  if (rpcError) {
    return createErrorResponse('Failed to delete user data')
  }

  for (const { bucket, path } of storagePaths) {
    try {
      await serviceClient.storage.from(bucket).remove([path])
    } catch {
      // Ignore storage cleanup errors
    }
  }

  const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(user.id)

  if (deleteAuthError) {
    return createErrorResponse('Failed to delete auth user')
  }

  return NextResponse.json({ success: true })
}
