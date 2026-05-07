import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

describe('GET /api/songs', () => {
  it('returns songs for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 1')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
