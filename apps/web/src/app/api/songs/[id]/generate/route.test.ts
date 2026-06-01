import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
    createServiceRoleClient: () => ({
      from: () => ({
        delete: () => ({
          lt: () => ({ then: async (resolve: any) => resolve({ error: null }) }),
        }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({ then: async (resolve: any) => resolve({ count: 0, error: null }) }),
            }),
          }),
        }),
        insert: () => ({ then: async (resolve: any) => resolve({ error: null }) }),
      }),
    }) as any,
  }
})

vi.mock('@kiyo/ai', () => ({
  generateMusic: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/songs/:id/generate', () => {
  it('returns 503 SERVICE_PAUSED for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'Song 1',
        user_id: 'user-1',
        status: 'draft',
        lyric_id: 'l1',
        ai_prompt: 'pop song',
        genre: 'pop',
        mood: 'happy',
      },
    ]
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 503 SERVICE_PAUSED even when song has no lyric_id', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', lyric_id: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 503 SERVICE_PAUSED even for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
