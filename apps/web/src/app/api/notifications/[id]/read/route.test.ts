import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from './route'
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

describe('PATCH /api/notifications/:id/read', () => {
  it('marks notification as read for owner', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      { id: 'n1', user_id: 'user-1', is_read: false },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n1/read', { method: 'PATCH' }),
      { params: { id: 'n1' } }
    )

    expect(response.status).toBe(200)
    expect(mockClient.dataStore.notifications[0].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n1/read', { method: 'PATCH' }),
      { params: { id: 'n1' } }
    )

    expect(response.status).toBe(401)
  })
})
