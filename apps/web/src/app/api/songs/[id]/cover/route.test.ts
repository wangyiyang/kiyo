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

describe('POST /api/songs/[id]/cover', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when action is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs/s1/cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when song not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when song belongs to another user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-2', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('creates generation task and returns 202 for async generate', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', genre: 'Pop', mood: 'Happy', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.coverStatus).toBe('generating')
    expect(json.task).toBeDefined()
    expect(json.task.type).toBe('cover')
    expect(json.task.song_id).toBe('s1')
    expect(json.task.status).toBe('pending')

    // Verify song cover_status updated
    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('generating')

    // Verify generation task created
    expect(mockClient.dataStore.generation_tasks).toHaveLength(1)
    const task = mockClient.dataStore.generation_tasks[0]
    expect(task.type).toBe('cover')
    expect(task.song_id).toBe('s1')
    expect(task.user_id).toBe('user-1')
    expect(task.payload.title).toBe('My Song')
    expect(task.payload.genre).toBe('Pop')
  })

  it('uploads cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const formData = new FormData()
    formData.append('file', new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' }))

    const request = new Request('http://localhost/api/songs/s1/cover?action=upload', {
      method: 'POST',
    })
    vi.spyOn(request, 'formData').mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverFilePath).toBeDefined()

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('completed')
    expect(song.cover_file_path).toBe(json.coverFilePath)
    expect(song.cover_url).toBeNull()
    expect(mockClient.uploadedFiles).toHaveLength(1)
  })

  it('returns 400 when upload file is not an image', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const formData = new FormData()
    formData.append('file', new File(['not-image'], 'readme.txt', { type: 'text/plain' }))

    const request = new Request('http://localhost/api/songs/s1/cover?action=upload', {
      method: 'POST',
    })
    vi.spyOn(request, 'formData').mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when upload file exceeds 5MB', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const formData = new FormData()
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
    formData.append('file', largeFile)

    const request = new Request('http://localhost/api/songs/s1/cover?action=upload', {
      method: 'POST',
    })
    vi.spyOn(request, 'formData').mockResolvedValue(formData)

    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
