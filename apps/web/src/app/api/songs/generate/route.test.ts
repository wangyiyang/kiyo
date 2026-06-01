// @ts-nocheck
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

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/songs/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/songs/generate (async)', () => {
  it('returns 503 SERVICE_PAUSED for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      title: 'Test Song',
      prompt: 'A happy pop song',
      mode: 'auto_lyrics',
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
      title: '',
      prompt: '',
      mode: 'invalid_mode',
    }))

    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error.code).toBe('SERVICE_PAUSED')
  })

  it('unauthenticated returns 401', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      title: 'Test Song',
      prompt: 'test',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
