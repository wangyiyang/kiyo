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
  it('auto_lyrics mode returns 202 and creates song + task', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A happy pop song',
      mode: 'auto_lyrics',
      genre: 'pop',
      mood: 'happy',
      language: 'en',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.song.status).toBe('generating')
    expect(json.song.source).toBe('ai_generated')
    expect(json.task.status).toBe('pending')
    expect(json.task.type).toBe('music')
    expect(json.task.payload.mode).toBe('auto_lyrics')
    expect(json.task.payload.prompt).toContain('英文')

    const task = mockClient.dataStore.generation_tasks[0]
    expect(task).toBeDefined()
    expect(task.user_id).toBe('user-1')
    expect(task.song_id).toBe(json.song.id)

    // 验证 started 通知已创建
    const notification = mockClient.dataStore.notifications[0]
    expect(notification).toBeDefined()
    expect(notification.type).toBe('generation')
    expect(notification.subtype).toBe('started')
    expect(notification.template_key).toBe('notification.generation.started')
    expect(notification.template_params.songTitle).toBe(json.song.title)
    expect(notification.user_id).toBe('user-1')
    expect(notification.song_id).toBe(json.song.id)
  })

  it('instrumental mode returns 202', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'Epic orchestral background',
      mode: 'instrumental',
      genre: 'orchestral',
      language: 'zh',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.song.status).toBe('generating')
    expect(json.task.payload.mode).toBe('instrumental')
  })

  it('existing_lyric mode returns 202', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A rock ballad',
      mode: 'existing_lyric',
      lyric_id: 'l1',
      genre: 'rock',
      language: 'ja',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.task.payload.lyric_id).toBe('l1')
  })

  it('invalid mode returns 400', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'invalid_mode',
    }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('existing_lyric missing lyric_id returns 400', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'existing_lyric',
    }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('lyric owned by another user returns 403', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-2', content: 'Secret lyrics' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'existing_lyric',
      lyric_id: 'l1',
    }))

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('unauthenticated returns 401', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 500 if task creation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })

    // Override generation_tasks insert to simulate failure
    const originalFrom = mockClient.from
    mockClient.from = (table: string) => {
      if (table === 'generation_tasks') {
        return {
          ...originalFrom(table),
          insert: () => ({
            data: null,
            error: null,
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
              then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve),
            }),
            then: (resolve: any) => Promise.resolve({ data: null, error: { message: 'DB error' } }).then(resolve),
          }),
        } as any
      }
      return originalFrom(table)
    }

    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A song',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
