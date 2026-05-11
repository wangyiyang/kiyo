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

describe('POST /api/songs', () => {
  it('creates song with 200', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song', genre: 'pop', mood: 'happy', ai_prompt: 'A pop song' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('My Song')
    expect(json.song.genre).toBe('pop')
    expect(json.song.mood).toBe('happy')
    expect(json.song.ai_prompt).toBe('A pop song')
    expect(json.song.status).toBe('draft')
    expect(json.song.source).toBe('manual')
    expect(json.song.user_id).toBe('user-1')
    expect(mockClient.dataStore.songs).toHaveLength(1)
  })

  it('creates song with lyric_id (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song', lyric_id: 'l1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.lyric_id).toBe('l1')
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ genre: 'pop' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/songs', () => {
  it('returns songs for authenticated user (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', created_at: '2024-01-01T00:00:00Z' },
      { id: 's2', title: 'Song 2', user_id: 'user-1', status: 'completed', created_at: '2024-01-02T00:00:00Z' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 2')
    expect(json.pagination).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 })
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs')
    const response = await GET(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('respects page and limit params', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i + 1}`,
      title: `Song ${i + 1}`,
      user_id: 'user-1',
      status: 'draft',
      created_at: `2024-01-0${i + 1}T00:00:00Z`,
    }))
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs?page=2&limit=2')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 3')
    expect(json.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 })
  })

  it('caps limit at MAX_LIMIT', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i + 1}`,
      title: `Song ${i + 1}`,
      user_id: 'user-1',
      status: 'draft',
      created_at: `2024-01-0${i + 1}T00:00:00Z`,
    }))
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs?page=1&limit=200')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.pagination.limit).toBe(100)
    expect(json.pagination.totalPages).toBe(1)
  })
})
