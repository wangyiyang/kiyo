import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

interface DeleteAccountBody {
  confirmation: string
  password: string
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: DeleteAccountBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  if (body.confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Confirmation must be "DELETE"' } },
      { status: 400 }
    )
  }

  if (!body.password || typeof body.password !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Password is required' } },
      { status: 400 }
    )
  }

  // 验证密码（同时检测 Magic Link 用户）
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.password,
  })

  if (signInError) {
    if (signInError.code === 'invalid_credentials') {
      return NextResponse.json(
        { error: { code: 'PASSWORD_INCORRECT', message: 'Current password is incorrect' } },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: { code: 'PASSWORD_INCORRECT', message: 'Password verification failed' } },
      { status: 403 }
    )
  }

  // 收集 Storage 路径
  const serviceClient = createServiceRoleClient()

  const [songsResult, albumsResult] = await Promise.all([
    serviceClient.from('songs').select('file_path, cover_url').eq('user_id', user.id),
    serviceClient.from('albums').select('cover_url').eq('user_id', user.id),
  ])

  const storagePaths: { bucket: string; path: string }[] = []

  if (songsResult.data) {
    for (const song of songsResult.data) {
      if (song.file_path) {
        storagePaths.push({ bucket: 'audio', path: song.file_path })
      }
      if (song.cover_url) {
        try {
          const url = new URL(song.cover_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('covers') + 1).join('/')
          if (filePath) storagePaths.push({ bucket: 'covers', path: filePath })
        } catch {
          // 忽略 URL 解析错误
        }
      }
    }
  }

  if (albumsResult.data) {
    for (const album of albumsResult.data) {
      if (album.cover_url) {
        try {
          const url = new URL(album.cover_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('covers') + 1).join('/')
          if (filePath) storagePaths.push({ bucket: 'covers', path: filePath })
        } catch {
          // 忽略 URL 解析错误
        }
      }
    }
  }

  // 原子删除数据库数据
  const { error: rpcError } = await serviceClient.rpc('delete_user_data', {
    target_user_id: user.id,
  })

  if (rpcError) {
    console.error('delete_user_data RPC failed:', rpcError)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user data' } },
      { status: 500 }
    )
  }

  // 清理 Storage（失败不阻断）
  for (const { bucket, path } of storagePaths) {
    try {
      await serviceClient.storage.from(bucket).remove([path])
    } catch (err) {
      console.error(`Failed to remove storage object ${bucket}/${path}:`, err)
    }
  }

  // 删除 Auth 用户
  const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(user.id)

  if (deleteAuthError) {
    console.error('Failed to delete auth user:', deleteAuthError)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete auth user' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
