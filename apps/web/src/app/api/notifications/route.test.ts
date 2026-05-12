import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from './route'
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

describe('GET /api/notifications', () => {
  it('returns notifications for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      {
        id: 'n1',
        user_id: 'user-1',
        type: 'generation',
        subtype: 'completed',
        template_key: 'notification.generation.completed',
        template_params: { songTitle: 'Test Song' },
        is_read: false,
        song_id: 's1',
        created_at: '2026-05-11T10:00:00Z',
      },
      {
        id: 'n2',
        user_id: 'user-1',
        type: 'generation',
        subtype: 'started',
        template_key: 'notification.generation.started',
        template_params: { songTitle: 'Another Song' },
        is_read: true,
        song_id: 's2',
        created_at: '2026-05-11T09:00:00Z',
      },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost/api/notifications'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].id).toBe('n1')
    expect(json.data[0].is_read).toBe(false)
    expect(json.data[1].id).toBe('n2')
    expect(json.data[1].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost/api/notifications'))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('PATCH /api/notifications (read-all)', () => {
  it('marks all unread notifications as read', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      { id: 'n1', user_id: 'user-1', is_read: false },
      { id: 'n2', user_id: 'user-1', is_read: false },
      { id: 'n3', user_id: 'user-1', is_read: true },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(new Request('http://localhost/api/notifications', { method: 'PATCH' }))

    expect(response.status).toBe(200)
    expect(mockClient.dataStore.notifications[0].is_read).toBe(true)
    expect(mockClient.dataStore.notifications[1].is_read).toBe(true)
    expect(mockClient.dataStore.notifications[2].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(new Request('http://localhost/api/notifications', { method: 'PATCH' }))

    expect(response.status).toBe(401)
  })
})
