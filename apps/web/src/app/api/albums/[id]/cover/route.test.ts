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

describe('POST /api/albums/[id]/cover', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when action is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when album belongs to another user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-2', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('creates generation task and returns 202 for async generate', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', description: 'A great album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.coverStatus).toBe('generating')
    expect(json.task).toBeDefined()
    expect(json.task.type).toBe('album_cover')
    expect(json.task.album_id).toBe('a1')
    expect(json.task.status).toBe('pending')

    // Verify album cover_status updated
    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('generating')

    // Verify generation task created
    expect(mockClient.dataStore.generation_tasks).toHaveLength(1)
    const task = mockClient.dataStore.generation_tasks[0]
    expect(task.type).toBe('album_cover')
    expect(task.album_id).toBe('a1')
    expect(task.user_id).toBe('user-1')
    expect(task.payload.title).toBe('My Album')
  })

  it('uploads cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const formData = new FormData()
    formData.append('file', new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' }))

    const request = new Request('http://localhost/api/albums/a1/cover?action=upload', {
      method: 'POST',
    })
    vi.spyOn(request, 'formData').mockResolvedValue(formData)
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverFilePath).toBeDefined()

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('completed')
    expect(album.cover_file_path).toBe(json.coverFilePath)
    expect(album.cover_url).toBeNull()
    expect(mockClient.uploadedFiles).toHaveLength(1)
  })

  it('returns 400 when upload file is not an image', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const formData = new FormData()
    formData.append('file', new File(['not-image'], 'readme.txt', { type: 'text/plain' }))

    const request = new Request('http://localhost/api/albums/a1/cover?action=upload', {
      method: 'POST',
    })
    vi.spyOn(request, 'formData').mockResolvedValue(formData)
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
