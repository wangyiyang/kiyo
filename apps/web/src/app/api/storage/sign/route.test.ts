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

async function setupMockClient(options: { userId?: string; songs?: any[]; albums?: any[] }) {
  const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
  const mockClient = createMockSupabaseClient({ userId: options.userId })
  if (options.songs) mockClient.dataStore.songs = options.songs
  if (options.albums) mockClient.dataStore.albums = options.albums

  // Bucket-aware storage mock
  mockClient.storage.from = vi.fn().mockImplementation((bucket: string) => ({
    upload: vi.fn().mockResolvedValue({ data: { path: 'mock' }, error: null }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock-cdn.supabase.co/storage/v1/object/public/${bucket}/${path}` },
    })),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: `https://mock-cdn.supabase.co/storage/v1/object/sign/${bucket}/mock-file?token=mock-token` },
      error: null,
    }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }))

  vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
  vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)
  return mockClient
}

describe('POST /api/storage/sign', () => {
  it('returns 400 for invalid bucket', async () => {
    await setupMockClient({})
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'invalid', path: 'test.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for missing path', async () => {
    await setupMockClient({})
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 for private song when not owner', async () => {
    await setupMockClient({
      userId: 'user-1',
      songs: [
        {
          id: 's1',
          title: 'Private Song',
          user_id: 'user-2',
          status: 'draft',
          file_path: 'user-2/s1/123.mp3',
          audio_url: null,
        },
      ],
    })

    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio', path: 'user-2/s1/123.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 with signedUrl for owner', async () => {
    await setupMockClient({
      userId: 'user-1',
      songs: [
        {
          id: 's1',
          title: 'My Song',
          user_id: 'user-1',
          status: 'completed',
          file_path: 'user-1/s1/123.mp3',
          audio_url: null,
        },
      ],
    })

    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio', path: 'user-1/s1/123.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.signedUrl).toContain('sign/audio')
    expect(json.expiresAt).toBeDefined()
  })

  it('returns 200 for public song when anonymous', async () => {
    await setupMockClient({
      userId: undefined,
      songs: [
        {
          id: 's1',
          title: 'Public Song',
          user_id: 'user-1',
          status: 'completed',
          file_path: 'user-1/s1/123.mp3',
          audio_url: null,
        },
      ],
    })

    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio', path: 'user-1/s1/123.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.signedUrl).toBeDefined()
  })

  it('returns 403 for album cover when not owner', async () => {
    await setupMockClient({
      userId: 'user-1',
      albums: [
        {
          id: 'a1',
          title: 'My Album',
          user_id: 'user-2',
          cover_file_path: 'user-2/a1/123.png',
          cover_url: null,
        },
      ],
    })

    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'covers', path: 'user-2/a1/123.png' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 for album cover when owner', async () => {
    await setupMockClient({
      userId: 'user-1',
      albums: [
        {
          id: 'a1',
          title: 'My Album',
          user_id: 'user-1',
          cover_file_path: 'user-1/a1/123.png',
          cover_url: null,
        },
      ],
    })

    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'covers', path: 'user-1/a1/123.png' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.signedUrl).toContain('sign/covers')
  })
})
