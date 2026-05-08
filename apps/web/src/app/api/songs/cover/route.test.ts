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

vi.mock('@kiyo/ai', () => ({
  generateCover: vi.fn(),
  MinimaxError: class MinimaxError extends Error {
    constructor(message: string, public code: string) {
      super(message)
      this.name = 'MinimaxError'
    }
  },
}))

beforeEach(() => {
  vi.resetAllMocks()
})

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/songs/cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/songs/cover', () => {
  it('creates cover song from existing song (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateCover } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: '原曲', user_id: 'user-1', audio_url: 'https://example.com/original.mp3', lyric_id: 'l1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateCover).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/cover.mp3',
      duration: 120,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    })

    const response = await POST(createRequest({
      voice_style: '爵士钢琴版，慵懒萨克斯',
      audio_url: 'https://example.com/original.mp3',
      original_song_id: 's1',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')
    expect(json.song.source).toBe('ai_cover')
    expect(json.song.original_song_id).toBe('s1')
    expect(json.song.voice_style).toBe('爵士钢琴版，慵懒萨克斯')
    expect(mockClient.dataStore.songs.length).toBeGreaterThanOrEqual(2)
  })

  it('creates cover song from uploaded audio (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateCover } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateCover).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/cover.mp3',
      duration: 90,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    })

    const response = await POST(createRequest({
      voice_style: '流行摇滚版，节奏更快',
      audio_url: 'https://mock-cdn.supabase.co/audio-uploads/user-1/test.mp3',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')
    expect(json.song.source).toBe('ai_cover')
    expect(json.song.original_song_id).toBeNull()
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: 'test style here',
      audio_url: 'https://example.com/test.mp3',
    }))

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid voice_style length', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: '短',
      audio_url: 'https://example.com/test.mp3',
    }))

    expect(response.status).toBe(400)
  })

  it('returns 400 when original song has no audio_url', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: '原曲', user_id: 'user-1', audio_url: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      voice_style: '流行摇滚版，节奏更快',
      audio_url: 'https://example.com/original.mp3',
      original_song_id: 's1',
    }))

    expect(response.status).toBe(400)
  })

  it('returns 422 and sets failed status when Minimax fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateCover, MinimaxError } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateCover).mockRejectedValue(new MinimaxError('Cover failed', 'api_error'))

    const response = await POST(createRequest({
      voice_style: '流行摇滚版，节奏更快，电吉他驱动',
      audio_url: 'https://example.com/test.mp3',
    }))

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error.code).toBe('GENERATION_FAILED')

    const failedSong = mockClient.dataStore.songs.find((s: any) => s.status === 'failed')
    expect(failedSong).toBeDefined()
  })
})
