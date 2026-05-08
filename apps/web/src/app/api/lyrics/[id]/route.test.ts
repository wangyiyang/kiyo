import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
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

describe('GET /api/lyrics/:id', () => {
  it('returns lyric detail (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('Lyric 1')
  })

  it('returns 404 for non-existent lyric', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('PATCH /api/lyrics/:id', () => {
  it('updates lyric fields (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Old', user_id: 'user-1', content: 'Old content', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New', content: 'New content' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('New')
    expect(json.lyric.content).toBe('New content')
  })

  it('returns 400 for invalid JSON body', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Old', user_id: 'user-1', content: 'Old content', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'l1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent lyric', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
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
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'l1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('DELETE /api/lyrics/:id', () => {
  it('deletes lyric (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
