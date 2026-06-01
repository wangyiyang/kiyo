import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { buildLyricsPrompt } from './lib'
import { createMockSupabaseClient } from '@/lib/test-utils'
import { MinimaxError, ProviderError } from '@kiyo/ai'

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

vi.mock('@kiyo/ai', async () => {
  const actual = await vi.importActual('@kiyo/ai')
  return {
    ...actual,
    routeLyrics: vi.fn(),
    generateLyrics: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/lyrics/generate', () => {
  it('returns 503 SERVICE_PAUSED for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 503 regardless of input validity', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('buildLyricsPrompt', () => {
  it('returns just the prompt when only prompt is provided', () => {
    expect(buildLyricsPrompt({ prompt: '一首关于青春的歌' })).toBe('一首关于青春的歌')
  })

  it('appends language when provided', () => {
    expect(buildLyricsPrompt({ prompt: '一首关于青春的歌', language: 'zh' })).toBe('一首关于青春的歌，语言：zh')
  })

  it('joins all params with comma when all are provided', () => {
    expect(
      buildLyricsPrompt({ prompt: '一首关于青春的歌', language: 'zh', style: '流行', mood: '励志' })
    ).toBe('一首关于青春的歌，语言：zh，风格：流行，情绪：励志')
  })
})
