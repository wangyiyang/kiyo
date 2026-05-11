import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit, createRateLimitResponse, type RateLimitAction } from './rate-limit'
import { createMockSupabaseClient } from './test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

function createMockRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('checkRateLimit', () => {
  it('allows request when under limit', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest()
    const result = await checkRateLimit('lyrics_generate', 'user-1', request)

    expect(result.allowed).toBe(true)
    expect(result.currentCount).toBe(1)
    expect(result.limit).toBe(10)
    expect(result.resetAfterSeconds).toBe(3600)
  })

  it('blocks request when limit exceeded', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })

    // Pre-populate rate_limits with max requests
    mockClient.dataStore.rate_limits = []
    for (let i = 0; i < 10; i++) {
      mockClient.dataStore.rate_limits.push({
        id: `rl-${i}`,
        key: 'user:user-1',
        action: 'lyrics_generate',
        created_at: new Date().toISOString(),
      })
    }

    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest()
    const result = await checkRateLimit('lyrics_generate', 'user-1', request)

    expect(result.allowed).toBe(false)
    expect(result.currentCount).toBe(10)
    expect(result.limit).toBe(10)
  })

  it('uses IP-based key when userId is undefined', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({})
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest({ 'x-forwarded-for': '192.168.1.1' })
    const result = await checkRateLimit('lyrics_generate', undefined, request)

    expect(result.allowed).toBe(true)
    // Verify the insert used IP-based key
    const inserted = mockClient.dataStore.rate_limits?.[0]
    expect(inserted?.key).toBe('ip:192.168.1.1')
  })

  it('falls back to x-real-ip when x-forwarded-for is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({})
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest({ 'x-real-ip': '10.0.0.1' })
    await checkRateLimit('song_generate', undefined, request)

    const inserted = mockClient.dataStore.rate_limits?.[0]
    expect(inserted?.key).toBe('ip:10.0.0.1')
  })

  it('falls back to unknown when no IP headers present', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({})
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest()
    await checkRateLimit('song_generate', undefined, request)

    const inserted = mockClient.dataStore.rate_limits?.[0]
    expect(inserted?.key).toBe('ip:unknown')
  })

  it('uses custom config when provided', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest()
    const result = await checkRateLimit('lyrics_generate', 'user-1', request, {
      windowMs: 60000,
      maxRequests: 2,
    })

    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(2)
    expect(result.resetAfterSeconds).toBe(60)
  })

  it('denies request when count query fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })

    // Override from to simulate count error
    const originalFrom = mockClient.from
    mockClient.from = (table: string) => {
      if (table === 'rate_limits') {
        const base = originalFrom(table)
        return {
          ...base,
          select: (columns?: string, options?: { count?: string }) => ({
            eq: (column: string, value: any) => ({
              eq: (column2: string, value2: any) => ({
                gte: (column3: string, value3: any) => ({
                  then: async (resolve: any) => {
                    // Simulate Supabase error response: resolve with error object
                    return resolve({ data: null, count: 0, error: { message: 'DB error' } })
                  },
                }),
              }),
              then: async (resolve: any) => {
                return resolve({ data: null, count: 0, error: { message: 'DB error' } })
              },
            }),
          }),
          delete: base.delete,
        } as any
      }
      return originalFrom(table)
    }

    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createMockRequest()
    const result = await checkRateLimit('lyrics_generate', 'user-1', request)

    expect(result.allowed).toBe(false)
  })
})

describe('createRateLimitResponse', () => {
  it('returns 429 with correct headers', () => {
    const result = {
      allowed: false,
      currentCount: 10,
      limit: 10,
      resetAfterSeconds: 3600,
    }

    const response = createRateLimitResponse(result)

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(response.headers.get('X-RateLimit-Reset')).toBe('3600')
  })

  it('returns correct remaining count when under limit', () => {
    const result = {
      allowed: true,
      currentCount: 3,
      limit: 10,
      resetAfterSeconds: 3600,
    }

    const response = createRateLimitResponse(result)
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('7')
  })
})
