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

vi.mock('@kiyo/ai', () => ({
  generateImage: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/albums/[id]/generate-cover', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when album belongs to another user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-2', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('generates cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', description: 'A great album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('completed')
    expect(album.cover_url).toBe(json.coverUrl)
    expect(mockClient.uploadedFiles).toHaveLength(1)
    expect(mockClient.uploadedFiles[0].path).toMatch(/^user-1\/a1\/\d+\.png$/)
  })

  it('returns 422 when Minimax generation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockRejectedValue(new Error('Minimax generation error'))

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })

  it('returns 500 when image download fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })

  it('returns 422 when Storage upload fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Storage error' } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })
})
