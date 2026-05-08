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
  generateMusic: vi.fn(),
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
  return new Request('http://localhost/api/songs/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/songs/generate', () => {
  it('auto_lyrics mode success (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateMusic } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateMusic).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/test.mp3',
      duration: 60,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    })

    const response = await POST(createRequest({
      prompt: 'A happy pop song',
      mode: 'auto_lyrics',
      genre: 'pop',
      mood: 'happy',
      language: 'en',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')
    expect(json.song.duration).toBe(60)
    expect(json.song.source).toBe('ai_generated')

    expect(generateMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        lyricsOptimizer: true,
      })
    )
  })

  it('instrumental mode success (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateMusic } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateMusic).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/test.mp3',
      duration: 45,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    })

    const response = await POST(createRequest({
      prompt: 'Epic orchestral background',
      mode: 'instrumental',
      genre: 'orchestral',
      language: 'zh',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')

    expect(generateMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        isInstrumental: true,
      })
    )
  })

  it('existing_lyric mode success (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateMusic } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateMusic).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/test.mp3',
      duration: 90,
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    })

    const response = await POST(createRequest({
      prompt: 'A rock ballad',
      mode: 'existing_lyric',
      lyric_id: 'l1',
      genre: 'rock',
      language: 'ja',
    }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')

    expect(generateMusic).toHaveBeenCalledWith(
      expect.objectContaining({
        lyrics: 'Line 1\nLine 2',
      })
    )
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

  it('Minimax failure returns 422 and updates song status to failed', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const { generateMusic, MinimaxError } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateMusic).mockRejectedValue(
      new MinimaxError('Generation timeout', 'timeout')
    )

    const response = await POST(createRequest({
      prompt: 'A song that will fail',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error.code).toBe('GENERATION_FAILED')

    const failedSong = mockClient.dataStore.songs.find((s: any) => s.status === 'failed')
    expect(failedSong).toBeDefined()
  })
})
