import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

describe('GET /api/songs/:id/export', () => {
  it('returns signed download URL for completed song with file_path (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'My Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: 'user-1/s1/1234567890.mp3',
        audio_url: 'https://mock.supabase.co/storage/v1/object/public/audio/user-1/s1/1234567890.mp3',
      },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.filename).toBe('My Song.mp3')
    expect(json.downloadUrl).toContain('sign/audio')
    expect(json.expiresAt).toBeDefined()
  })

  it('falls back to parsing audio_url when file_path is missing (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'Old Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: null,
        audio_url: 'https://mock.supabase.co/storage/v1/object/public/audio/user-1/s1/0987654321.mp3',
      },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.filename).toBe('Old Song.mp3')
  })

  it('returns 400 for non-completed song', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Draft', user_id: 'user-1', status: 'draft', file_path: null, audio_url: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when no audio file exists', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'No Audio', user_id: 'user-1', status: 'completed', file_path: null, audio_url: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.message).toBe('No audio file available')
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

  it('returns 500 when storage signature fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'My Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: 'user-1/s1/1234567890.mp3',
        audio_url: null,
      },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
