import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { buildLyricsPrompt } from './lib'
import { createMockSupabaseClient } from '@/lib/test-utils'
import { MinimaxError } from '@kiyo/ai'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

vi.mock('@kiyo/ai', async () => {
  const actual = await vi.importActual('@kiyo/ai')
  return {
    ...actual,
    generateLyrics: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/lyrics/generate', () => {
  it('generates lyrics with AI and creates record (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const { generateLyrics } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateLyrics).mockResolvedValue({
      text: '[Verse 1]\nGenerated line',
    })

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: '一首关于青春的歌',
        language: 'zh',
        style: '流行',
        mood: '励志',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.source).toBe('ai_generated')
    expect(json.lyric.status).toBe('draft')
    expect(json.lyric.ai_prompt).toBe('一首关于青春的歌')
    expect(json.lyric.language).toBe('zh')
    expect(json.lyric.title).toBe('一首关于青春的歌')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when prompt is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ language: 'zh' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 422 when AI generation throws MinimaxError', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const { generateLyrics } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateLyrics).mockRejectedValue(new MinimaxError('API failed', 'api_error'))

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.error.code).toBe('GENERATION_FAILED')
  })

  it('returns 400 when prompt is empty string', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when prompt is whitespace only', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: '   ' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when prompt is not a string', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 123 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when language is not a string', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', language: 123 }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.message).toBe('Language must be a string')
  })

  it('returns 400 when style is not a string', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', style: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.message).toBe('Style must be a string')
  })

  it('returns 400 when mood is not a string', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test', mood: {} }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
    expect(json.error.message).toBe('Mood must be a string')
  })

  it('returns 500 when DB insert fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const { generateLyrics } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })

    const insertError = new Error('insert failed')
    const originalFrom = mockClient.from
    mockClient.from = vi.fn((table: string) => {
      const chain = originalFrom(table)
      return {
        ...chain,
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: insertError }),
          }),
        }),
      }
    }) as any

    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateLyrics).mockResolvedValue({ text: 'lyric text' })

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
    expect(json.error.message).toBe('insert failed')
  })
})

describe('buildLyricsPrompt', () => {
  it('returns just the prompt when only prompt is provided', () => {
    expect(buildLyricsPrompt({ prompt: '一首关于青春的歌' })).toBe('一首关于青春的歌')
  })

  it('appends language when provided', () => {
    expect(buildLyricsPrompt({ prompt: '一首关于青春的歌', language: 'zh' })).toBe('一首关于青春的歌，语言：zh')
  })

  it('joins all params with comma when all are provided', () => {
    expect(
      buildLyricsPrompt({ prompt: '一首关于青春的歌', language: 'zh', style: '流行', mood: '励志' })
    ).toBe('一首关于青春的歌，语言：zh，风格：流行，情绪：励志')
  })
})
