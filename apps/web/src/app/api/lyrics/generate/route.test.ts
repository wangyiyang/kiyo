import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

vi.mock('@kiyo/ai', () => ({
  generateLyrics: vi.fn(),
}))

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
})
