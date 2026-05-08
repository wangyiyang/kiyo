import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/albums/[id]', () => {
  it('returns album detail with songs (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's1', order_index: 0 },
      { album_id: 'a1', song_id: 's2', order_index: 1 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1')
    const response = await GET(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.album.id).toBe('a1')
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].id).toBe('s1')
    expect(json.songs[1].id).toBe('s2')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1')
    const response = await GET(request, { params: { id: 'a1' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /api/albums/[id]', () => {
  it('updates album and song order (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
      { id: 's3', title: 'Song 3', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's1', order_index: 0 },
      { album_id: 'a1', song_id: 's2', order_index: 1 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated Album', song_ids: ['s3', 's1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.album.title).toBe('Updated Album')

    const albumSongs = mockClient.dataStore.album_songs.filter((as) => as.album_id === 'a1')
    expect(albumSongs).toHaveLength(2)
    expect(albumSongs[0].song_id).toBe('s3')
    expect(albumSongs[0].order_index).toBe(0)
    expect(albumSongs[1].song_id).toBe('s1')
    expect(albumSongs[1].order_index).toBe(1)
  })

  it('returns 403 when song_ids contain non-owned songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', {
      method: 'PATCH',
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: { id: 'a1' } })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })
})

describe('DELETE /api/albums/[id]', () => {
  it('deletes album successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', { method: 'DELETE' })
    const response = await DELETE(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(mockClient.dataStore.albums).toHaveLength(0)
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', { method: 'DELETE' })
    const response = await DELETE(request, { params: { id: 'a1' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
