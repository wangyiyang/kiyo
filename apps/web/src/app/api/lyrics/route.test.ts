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

describe('POST /api/lyrics', () => {
  it('creates lyric with 200', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Lyric', content: 'Line 1\nLine 2', language: 'zh', style: 'pop', mood: 'happy' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('My Lyric')
    expect(json.lyric.content).toBe('Line 1\nLine 2')
    expect(json.lyric.language).toBe('zh')
    expect(json.lyric.style).toBe('pop')
    expect(json.lyric.mood).toBe('happy')
    expect(json.lyric.source).toBe('manual')
    expect(json.lyric.status).toBe('draft')
    expect(json.lyric.user_id).toBe('user-1')
    expect(mockClient.dataStore.lyrics).toHaveLength(1)
    expect(mockClient.dataStore.lyrics[0].title).toBe('My Lyric')
    expect(mockClient.dataStore.lyrics[0].source).toBe('manual')
  })

  it('creates lyric with minimal fields (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ title: 'Minimal', content: 'Line' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('Minimal')
    expect(json.lyric.content).toBe('Line')
    expect(json.lyric.language).toBeNull()
    expect(json.lyric.style).toBeNull()
    expect(json.lyric.mood).toBeNull()
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ content: 'Some content' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when content is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Lyric' }),
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

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Lyric', content: 'Some content' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/lyrics', () => {
  it('returns lyrics for authenticated user (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', created_at: '2024-01-01T00:00:00Z' },
      { id: 'l2', title: 'Lyric 2', user_id: 'user-1', created_at: '2024-01-02T00:00:00Z' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyrics).toHaveLength(2)
    expect(json.lyrics[0].title).toBe('Lyric 2')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
