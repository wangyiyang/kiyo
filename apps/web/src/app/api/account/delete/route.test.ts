import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
    createServiceRoleClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

function createDeleteRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/account/delete', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'pass' }))
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when confirmation is not DELETE', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'WRONG', password: 'pass' }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when password is incorrect', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const serviceClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'wrong-password' }))
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('PASSWORD_INCORRECT')
  })

  it('returns 200 and deletes user data when password is correct', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const serviceClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as any)

    serviceClient.dataStore.songs.push({
      id: 'song-1',
      user_id: 'user-1',
      file_path: 'user-1/audio.mp3',
      cover_url: 'https://cdn.supabase.co/storage/v1/object/public/covers/user-1/cover.jpg',
    })
    serviceClient.dataStore.albums.push({
      id: 'album-1',
      user_id: 'user-1',
      cover_url: 'https://cdn.supabase.co/storage/v1/object/public/covers/user-1/album-cover.jpg',
    })

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'correct-password' }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)

    expect(serviceClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })
})
