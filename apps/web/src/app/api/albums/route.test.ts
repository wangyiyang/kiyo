import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
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

describe('POST /api/albums', () => {
  it('creates album with songs (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Album', song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.album.title).toBe('My Album')
    expect(json.album.user_id).toBe('user-1')

    const albumSongs = mockClient.dataStore.album_songs
    expect(albumSongs).toHaveLength(2)
    expect(albumSongs[0].song_id).toBe('s1')
    expect(albumSongs[0].order_index).toBe(0)
    expect(albumSongs[1].song_id).toBe('s2')
    expect(albumSongs[1].order_index).toBe(1)
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when song_ids contain songs not owned by user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Album', song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Album', song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/albums', () => {
  it('returns albums for authenticated user (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
      { id: 'a2', title: 'Album 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.albums).toHaveLength(2)
    expect(json.albums[0].title).toBe('Album 1')
    expect(json.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 })
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('respects page and limit params', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i + 1}`,
      title: `Album ${i + 1}`,
      user_id: 'user-1',
      created_at: `2024-01-0${i + 1}T00:00:00Z`,
    }))
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums?page=2&limit=2')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.albums).toHaveLength(2)
    expect(json.albums[0].title).toBe('Album 3')
    expect(json.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 })
  })
})
