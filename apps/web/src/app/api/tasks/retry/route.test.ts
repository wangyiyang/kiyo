import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
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

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/tasks/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/tasks/retry', () => {
  it('resets failed task to pending and updates song status (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', user_id: 'user-1', status: 'failed', title: 'Song 1' },
    ]
    mockClient.dataStore.generation_tasks = [
      { id: 't1', song_id: 's1', user_id: 'user-1', status: 'failed', type: 'music', retry_count: 3, max_retries: 3 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.task.status).toBe('pending')
    expect(json.task.retry_count).toBe(0)

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.status).toBe('generating')
  })

  it('returns 404 if no failed task found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 if song_id missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({}))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
