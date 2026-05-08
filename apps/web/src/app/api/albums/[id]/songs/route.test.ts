import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/albums/[id]/songs', () => {
  it('adds songs to album successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's3', order_index: 0 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.added).toBe(2)

    const albumSongs = mockClient.dataStore.album_songs.filter((as) => as.album_id === 'a1')
    expect(albumSongs).toHaveLength(3)
    const s1Entry = albumSongs.find((as) => as.song_id === 's1')
    const s2Entry = albumSongs.find((as) => as.song_id === 's2')
    expect(s1Entry?.order_index).toBe(1)
    expect(s2Entry?.order_index).toBe(2)
  })

  it('returns 400 for empty song_ids array', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when song_ids contain non-owned songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
