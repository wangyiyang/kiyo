import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

async function setupMockClient(options: { songs?: any[] } = {}) {
  const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
  const mockClient = createMockSupabaseClient()
  if (options.songs) mockClient.dataStore.songs = options.songs

  // Bucket-aware storage mock
  mockClient.storage.from = vi.fn().mockImplementation((bucket: string) => ({
    upload: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: null }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock-cdn.supabase.co/storage/v1/object/public/${bucket}/${path}` },
    })),
    createSignedUrl: vi.fn().mockImplementation((path: string) =>
      Promise.resolve({
        data: { signedUrl: `https://mock-cdn.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock-token` },
        error: null,
      })
    ),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }))

  vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
  vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)
  return mockClient
}

describe('GET /api/explore/songs', () => {
  it('returns public songs without auth (200)', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Song 1', is_public: true, created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'Song 2', is_public: true, created_at: '2024-01-02T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.pagination.page).toBe(1)
    expect(json.pagination.limit).toBe(18)
    expect(json.pagination.total).toBe(2)
    expect(json.pagination.hasMore).toBe(false)
  })

  it('respects page and limit params', async () => {
    await setupMockClient({
      songs: Array.from({ length: 5 }, (_, i) => ({
        id: `s${i + 1}`,
        title: `Song ${i + 1}`,
        is_public: true,
        created_at: `2024-01-0${i + 1}T00:00:00Z`,
      })),
    })

    const request = new Request('http://localhost/api/explore/songs?page=2&limit=2')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 3')
    expect(json.pagination.page).toBe(2)
    expect(json.pagination.limit).toBe(2)
    expect(json.pagination.hasMore).toBe(true)
  })

  it('filters by genre', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Rock Song', is_public: true, genre: 'rock', created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'Pop Song', is_public: true, genre: 'pop', created_at: '2024-01-02T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs?genre=rock')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(1)
    expect(json.songs[0].title).toBe('Rock Song')
  })

  it('filters by mood', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Happy Song', is_public: true, mood: 'happy', created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'Sad Song', is_public: true, mood: 'sad', created_at: '2024-01-02T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs?mood=happy')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(1)
    expect(json.songs[0].title).toBe('Happy Song')
  })

  it('searches public songs by title', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Midnight City Lights', is_public: true, created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'Morning Piano Sketch', is_public: true, created_at: '2024-01-02T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs?q=city')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(1)
    expect(json.songs[0].title).toBe('Midnight City Lights')
  })

  it('sorts songs with cover first', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'No Cover', is_public: true, cover_file_path: null, created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'With Cover', is_public: true, cover_file_path: 'covers/s2.png', created_at: '2024-01-02T00:00:00Z' },
        { id: 's3', title: 'Also No Cover', is_public: true, cover_file_path: null, created_at: '2024-01-03T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs[0].title).toBe('With Cover')
    expect(json.songs[1].title).toBe('Also No Cover')
    expect(json.songs[2].title).toBe('No Cover')
  })

  it('batch signs cover_file_path and sets cover_url', async () => {
    const mockClient = await setupMockClient({
      songs: [
        { id: 's1', title: 'Song 1', is_public: true, cover_file_path: 'covers/s1.png', created_at: '2024-01-01T00:00:00Z' },
        { id: 's2', title: 'Song 2', is_public: true, cover_file_path: 'covers/s2.png', created_at: '2024-01-02T00:00:00Z' },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    // s2 has newer created_at, so it sorts first after cover sort
    expect(json.songs[0].cover_url).toContain('sign/covers/covers/s2.png')
    expect(json.songs[1].cover_url).toContain('sign/covers/covers/s1.png')
    expect(mockClient.storage.from).toHaveBeenCalledWith('covers')
  })

  it('returns empty array when no public songs', async () => {
    await setupMockClient({ songs: [] })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toEqual([])
    expect(json.pagination.total).toBe(0)
    expect(json.pagination.hasMore).toBe(false)
  })

  it('caps limit at MAX_LIMIT (50)', async () => {
    await setupMockClient({
      songs: Array.from({ length: 60 }, (_, i) => ({
        id: `s${i + 1}`,
        title: `Song ${i + 1}`,
        is_public: true,
        created_at: `2024-01-01T00:00:00Z`,
      })),
    })

    const request = new Request('http://localhost/api/explore/songs?page=1&limit=100')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.pagination.limit).toBe(50)
    expect(json.songs).toHaveLength(50)
    expect(json.pagination.hasMore).toBe(true)
  })
})
