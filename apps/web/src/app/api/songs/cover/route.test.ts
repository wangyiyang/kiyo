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
  generateCover: vi.fn(),
  MinimaxError: class MinimaxError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'MinimaxError'
    }
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
})

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/songs/cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/songs/cover', () => {
  it('returns 503 SERVICE_PAUSED for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: '爵士钢琴版，慵懒萨克斯',
      audio_url: 'https://example.com/original.mp3',
      original_song_id: 's1',
    }))

    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 503 regardless of input validity', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: '短',
      audio_url: '',
    }))

    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: 'test style here',
      audio_url: 'https://example.com/test.mp3',
    }))

    expect(response.status).toBe(401)
  })
})
