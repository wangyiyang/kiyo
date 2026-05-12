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

describe('GET /api/songs/:id', () => {
  it('returns song detail with lyrics (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', lyric_id: 'l1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('Song 1')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('PATCH /api/songs/:id', () => {
  it('updates song fields (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Old', user_id: 'user-1', status: 'draft', genre: 'pop', mood: 'happy' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New', genre: 'rock' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('New')
    expect(json.song.genre).toBe('rock')
  })

  it('rejects updates to protected fields (400)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Old', user_id: 'user-1', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', audio_url: 'http://example.com/audio.mp3' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('updates is_public field (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song', user_id: 'user-1', status: 'completed', is_public: false },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.is_public).toBe(true)
  })

  it('rejects invalid is_public value (400)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song', user_id: 'user-1', status: 'completed' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /api/songs/:id', () => {
  it('deletes song (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(mockClient.dataStore.songs).toHaveLength(0)
  })

  it('removes storage file by file_path when available', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })
    mockClient.storage.from = vi.fn().mockReturnValue({ remove: removeMock })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'completed', file_path: 'audio/user-1/song1.mp3', audio_url: 'https://cdn.example.com/audio/old-path.mp3' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    expect(removeMock).toHaveBeenCalledWith(['audio/user-1/song1.mp3'])
  })

  it('falls back to parsing audio_url when file_path is absent', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const removeMock = vi.fn().mockResolvedValue({ data: null, error: null })
    mockClient.storage.from = vi.fn().mockReturnValue({ remove: removeMock })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'completed', file_path: null, audio_url: 'https://cdn.example.com/storage/v1/object/public/audio/user-1/song1.mp3' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    expect(removeMock).toHaveBeenCalledWith(['user-1/song1.mp3'])
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
