# AI 音乐作曲实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Issue #24 的 AI 音乐作曲功能：用户输入参数后一站式生成音乐并保存到歌曲库。

**Architecture:** 同步一站式流程。前端 `/songs/generate` 表单 → `POST /api/songs/generate` 创建记录并同步调用 Minimax → 下载上传音频 → 返回 song → 前端自动跳转详情页。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Minimax API, Supabase

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `packages/ai/src/music.ts` | `generateMusic` 函数，补齐 `lyricsOptimizer` | 修改 |
| `packages/ai/src/__tests__/music.test.ts` | `generateMusic` 单元测试 | 修改 |
| `apps/web/src/app/api/songs/generate/route.ts` | 新的 `POST /api/songs/generate` 路由 | 新建 |
| `apps/web/src/app/api/songs/generate/route.test.ts` | API 路由测试 | 新建 |
| `apps/web/src/app/songs/generate/page.tsx` | AI 作曲表单页面 | 新建 |
| `apps/web/src/app/songs/page.tsx` | 增加「AI 作曲」入口按钮 | 修改 |

---

### Task 1: 补齐 `generateMusic` 的 `lyricsOptimizer` 参数

**Files:**
- Modify: `packages/ai/src/music.ts`
- Test: `packages/ai/src/__tests__/music.test.ts`

- [ ] **Step 1: 查看当前 `music.ts` 代码**

  Run: `cat packages/ai/src/music.ts`

- [ ] **Step 2: 写测试 — `lyricsOptimizer` 透传到请求体**

  替换 `packages/ai/src/__tests__/music.test.ts` 全部内容：

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
  import { generateMusic } from '../music'
  import { MinimaxError } from '../errors'

  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.MINIMAX_API_KEY
  })

  describe('generateMusic', () => {
    it('returns audioUrl and duration on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/test.mp3', status: 1 },
          extra_info: { music_duration: 120000 },
        }),
      } as Response)

      const result = await generateMusic({ prompt: 'pop song', genre: 'pop', mood: 'happy' })
      expect(result.audioUrl).toBe('https://cdn.minimaxi.com/audio/test.mp3')
      expect(result.duration).toBe(120)
    })

    it('passes lyricsOptimizer to request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/test.mp3', status: 1 },
          extra_info: { music_duration: 60000 },
        }),
      } as Response)

      await generateMusic({ prompt: 'pop song', lyricsOptimizer: true })

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.lyrics_optimizer).toBe(true)
      expect(body.model).toBe('music-2.6')
    })

    it('passes isInstrumental to request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/test.mp3', status: 1 },
          extra_info: { music_duration: 60000 },
        }),
      } as Response)

      await generateMusic({ prompt: 'calm instrumental', isInstrumental: true })

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.is_instrumental).toBe(true)
    })

    it('passes lyrics to request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/test.mp3', status: 1 },
          extra_info: { music_duration: 60000 },
        }),
      } as Response)

      await generateMusic({ lyrics: '[Verse]\nHello world' })

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.lyrics).toBe('[Verse]\nHello world')
    })

    it('throws MinimaxError when API returns no audio', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      } as Response)

      await expect(generateMusic({ prompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
    })
  })
  ```

- [ ] **Step 3: 运行测试，确认失败**

  Run: `pnpm test -- --filter=@kiyo/ai`

  Expected: 部分测试失败，因为当前 `generateMusic` 仍是 stub 实现

- [ ] **Step 4: 实现 `generateMusic`**

  替换 `packages/ai/src/music.ts` 全部内容：

  ```typescript
  import { minimaxFetch } from './client'
  import { MinimaxError } from './errors'

  export interface GenerateMusicOptions {
    prompt?: string
    lyrics?: string
    genre?: string
    mood?: string
    isInstrumental?: boolean
    lyricsOptimizer?: boolean
  }

  export interface GenerateMusicResult {
    audioUrl: string
    duration: number
  }

  export async function generateMusic(
    options: GenerateMusicOptions
  ): Promise<GenerateMusicResult> {
    const parts: string[] = []
    if (options.prompt) parts.push(options.prompt)
    if (options.genre) parts.push(`风格：${options.genre}`)
    if (options.mood) parts.push(`情绪：${options.mood}`)
    const fullPrompt = parts.join('，')

    const body: Record<string, unknown> = {
      model: 'music-2.6',
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    }

    if (fullPrompt) {
      body.prompt = fullPrompt
    }

    if (options.lyrics) {
      body.lyrics = options.lyrics
    }

    if (options.isInstrumental) {
      body.is_instrumental = true
    }

    if (options.lyricsOptimizer) {
      body.lyrics_optimizer = true
    }

    const response = await minimaxFetch('/v1/music_generation', {
      method: 'POST',
      body: JSON.stringify(body),
    })

    const data = response as {
      data?: { audio?: string; status?: number }
      extra_info?: { music_duration?: number }
    }

    if (!data.data?.audio) {
      throw new MinimaxError('Invalid response from music generation API', 'api_error')
    }

    const durationMs = data.extra_info?.music_duration ?? 0
    const durationSeconds = Math.round(durationMs / 1000)

    return {
      audioUrl: data.data.audio,
      duration: durationSeconds,
    }
  }
  ```

- [ ] **Step 5: 运行测试，确认通过**

  Run: `pnpm test -- --filter=@kiyo/ai`

  Expected: 所有测试通过

- [ ] **Step 6: Commit**

  ```bash
  git add packages/ai/src/music.ts packages/ai/src/__tests__/music.test.ts
  git commit -m "feat(ai): add lyricsOptimizer and isInstrumental to generateMusic"
  ```

---

### Task 2: 实现 `POST /api/songs/generate` 路由

**Files:**
- Create: `apps/web/src/app/api/songs/generate/route.ts`
- Test: `apps/web/src/app/api/songs/generate/route.test.ts`

- [ ] **Step 1: 写测试 — 成功路径（auto_lyrics 模式）**

  创建 `apps/web/src/app/api/songs/generate/route.test.ts`：

  ```typescript
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
    generateMusic: vi.fn(),
    MinimaxError: class MinimaxError extends Error {
      code: string
      constructor(message: string, code: string) {
        super(message)
        this.code = code
      }
    },
  }))

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('POST /api/songs/generate', () => {
    it('generates music with auto_lyrics mode (200)', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
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

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '一首关于夏天的歌',
          genre: '流行',
          mood: '欢快',
          language: 'zh',
          mode: 'auto_lyrics',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.song.status).toBe('completed')
      expect(json.song.source).toBe('ai_generated')
      expect(json.song.duration).toBe(60)
      expect(mockClient.dataStore.songs).toHaveLength(1)
    })

    it('generates music with instrumental mode (200)', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
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

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '冥想背景音乐',
          mode: 'instrumental',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.song.status).toBe('completed')
    })

    it('generates music with existing_lyric mode (200)', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const { generateMusic } = await import('@kiyo/ai')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      mockClient.dataStore.lyrics = [
        { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
      ]
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
      vi.mocked(generateMusic).mockResolvedValue({
        audioUrl: 'https://cdn.minimaxi.com/audio/test.mp3',
        duration: 60,
      })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
      })

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: '一首忧伤的歌',
          mode: 'existing_lyric',
          lyric_id: 'l1',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.song.lyric_id).toBe('l1')
    })

    it('returns 400 for invalid mode', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', mode: 'invalid' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 when existing_lyric mode missing lyric_id', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', mode: 'existing_lyric' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 403 when lyric belongs to another user', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      mockClient.dataStore.lyrics = [
        { id: 'l1', title: 'Lyric 1', user_id: 'user-2', content: 'Line 1' },
      ]
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', mode: 'existing_lyric', lyric_id: 'l1' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it('returns 401 when not authenticated', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: undefined })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', mode: 'auto_lyrics' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 422 when Minimax API fails', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const { generateMusic, MinimaxError } = await import('@kiyo/ai')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
      vi.mocked(generateMusic).mockRejectedValue(new MinimaxError('Generation failed', 'api_error'))

      const request = new Request('http://localhost/api/songs/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'test', mode: 'auto_lyrics' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(422)
      const json = await response.json()
      expect(json.error.code).toBe('GENERATION_FAILED')

      // Verify song status was set to failed
      const song = mockClient.dataStore.songs[0]
      expect(song.status).toBe('failed')
    })
  })
  ```

- [ ] **Step 2: 运行测试，确认失败**

  Run: `pnpm test -- --filter=web -- apps/web/src/app/api/songs/generate/route.test.ts`

  Expected: 全部失败，因为路由文件不存在

- [ ] **Step 3: 实现路由**

  创建 `apps/web/src/app/api/songs/generate/route.ts`：

  ```typescript
  import { createServerClient } from '@kiyo/supabase'
  import { generateMusic, MinimaxError } from '@kiyo/ai'
  import { NextResponse } from 'next/server'

  const VALID_MODES = ['instrumental', 'auto_lyrics', 'existing_lyric'] as const
  type Mode = (typeof VALID_MODES)[number]

  const LANGUAGE_MAP: Record<string, string> = {
    zh: '中文',
    en: '英文',
    ja: '日文',
  }

  export async function POST(request: Request) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
        { status: 400 }
      )
    }

    const { prompt, genre, mood, language, mode, lyric_id } = body

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } },
        { status: 400 }
      )
    }

    if (!VALID_MODES.includes(mode as Mode)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid mode' } },
        { status: 400 }
      )
    }

    if (mode === 'existing_lyric') {
      if (!lyric_id || typeof lyric_id !== 'string') {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'lyric_id is required for existing_lyric mode' } },
          { status: 400 }
        )
      }
    }

    // Build prompt with language injection
    const parts: string[] = [prompt.trim()]
    if (language && typeof language === 'string' && LANGUAGE_MAP[language]) {
      parts.unshift(`${LANGUAGE_MAP[language]}歌曲`)
    }
    if (genre && typeof genre === 'string') {
      parts.push(`风格：${genre}`)
    }
    if (mood && typeof mood === 'string') {
      parts.push(`情绪：${mood}`)
    }
    const fullPrompt = parts.join('，')

    // For existing_lyric mode, fetch the lyric first
    let lyricsContent = ''
    if (mode === 'existing_lyric') {
      const { data: lyric, error: lyricError } = await supabase
        .from('lyrics')
        .select('content, user_id')
        .eq('id', lyric_id)
        .single()

      if (lyricError || !lyric) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
          { status: 404 }
        )
      }

      if (lyric.user_id !== user.id) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Cannot use lyric from another user' } },
          { status: 403 }
        )
      }

      lyricsContent = lyric.content
    }

    // Create song record with generating status
    const { data: song, error: createError } = await supabase
      .from('songs')
      .insert({
        title: prompt.trim(),
        genre: typeof genre === 'string' ? genre : null,
        mood: typeof mood === 'string' ? mood : null,
        ai_prompt: fullPrompt,
        lyric_id: mode === 'existing_lyric' ? lyric_id : null,
        status: 'generating',
        source: 'ai_generated',
        user_id: user.id,
      })
      .select()
      .single()

    if (createError || !song) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: createError?.message || 'Failed to create song' } },
        { status: 500 }
      )
    }

    try {
      // Call generateMusic based on mode
      const musicOptions: Parameters<typeof generateMusic>[0] = {
        prompt: fullPrompt,
      }

      if (mode === 'instrumental') {
        musicOptions.isInstrumental = true
      } else if (mode === 'auto_lyrics') {
        musicOptions.lyricsOptimizer = true
      } else if (mode === 'existing_lyric') {
        musicOptions.lyrics = lyricsContent
      }

      const result = await generateMusic(musicOptions)

      // Download audio
      const audioResponse = await fetch(result.audioUrl)
      if (!audioResponse.ok) {
        throw new Error('Failed to download audio')
      }
      const audioBuffer = await audioResponse.arrayBuffer()

      // Upload to Storage
      const filePath = `${user.id}/${song.id}/${Date.now()}.mp3`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

      // Update song record
      const { data: updatedSong, error: updateError } = await supabase
        .from('songs')
        .update({
          audio_url: publicUrl.publicUrl,
          duration: result.duration,
          status: 'completed',
        })
        .eq('id', song.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`)
      }

      return NextResponse.json({ song: updatedSong })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Music generation failed'

      // Mark song as failed
      await supabase
        .from('songs')
        .update({ status: 'failed' })
        .eq('id', song.id)

      const isMinimaxError = err instanceof MinimaxError
      return NextResponse.json(
        {
          error: {
            code: isMinimaxError ? 'GENERATION_FAILED' : 'INTERNAL_ERROR',
            message,
          },
        },
        { status: isMinimaxError ? 422 : 500 }
      )
    }
  }
  ```

- [ ] **Step 4: 运行测试，确认通过**

  Run: `pnpm test -- --filter=web -- apps/web/src/app/api/songs/generate/route.test.ts`

  Expected: 所有 7 个测试通过

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/api/songs/generate/
  git commit -m "feat(api): add POST /api/songs/generate for AI music composition"
  ```

---

### Task 3: 实现 AI 作曲前端页面

**Files:**
- Create: `apps/web/src/app/songs/generate/page.tsx`

- [ ] **Step 1: 创建页面**

  创建 `apps/web/src/app/songs/generate/page.tsx`：

  ```tsx
  'use client'

  import * as React from 'react'
  import { useRouter } from 'next/navigation'
  import { Button, Input, Label, Textarea } from '@kiyo/ui'
  import { ArrowLeft, Wand2 } from 'lucide-react'
  import Link from 'next/link'

  type Mode = 'instrumental' | 'auto_lyrics' | 'existing_lyric'

  const MODE_OPTIONS: { value: Mode; label: string; description: string; icon: string }[] = [
    { value: 'instrumental', label: '纯音乐', description: '无人声伴奏', icon: '🎵' },
    { value: 'auto_lyrics', label: '自动写词', description: 'AI 自动生成歌词后作曲', icon: '✍️' },
    { value: 'existing_lyric', label: '已有歌词', description: '使用已有歌词进行作曲', icon: '📝' },
  ]

  const LANGUAGES = [
    { value: '', label: '不限' },
    { value: 'zh', label: '中文' },
    { value: 'en', label: '英文' },
    { value: 'ja', label: '日文' },
  ]

  export default function GenerateSongPage() {
    const router = useRouter()
    const [generating, setGenerating] = React.useState(false)
    const [prompt, setPrompt] = React.useState('')
    const [genre, setGenre] = React.useState('')
    const [mood, setMood] = React.useState('')
    const [language, setLanguage] = React.useState('')
    const [mode, setMode] = React.useState<Mode>('auto_lyrics')
    const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
    const [selectedLyricId, setSelectedLyricId] = React.useState('')
    const [error, setError] = React.useState('')

    React.useEffect(() => {
      if (mode === 'existing_lyric') {
        fetch('/api/lyrics')
          .then((res) => res.json())
          .then((data) => {
            if (data.lyrics) setLyrics(data.lyrics)
          })
      }
    }, [mode])

    const handleGenerate = async () => {
      if (!prompt.trim()) {
        setError('请输入主题描述')
        return
      }
      if (mode === 'existing_lyric' && !selectedLyricId) {
        setError('请选择要关联的歌词')
        return
      }

      setGenerating(true)
      setError('')

      try {
        const res = await fetch('/api/songs/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            genre: genre || undefined,
            mood: mood || undefined,
            language: language || undefined,
            mode,
            lyric_id: mode === 'existing_lyric' ? selectedLyricId : undefined,
          }),
        })

        const data = await res.json()
        if (res.ok && data.song) {
          router.push(`/songs/${data.song.id}`)
        } else {
          setError(data.error?.message || '生成失败，请重试')
          setGenerating(false)
        }
      } catch {
        setError('生成失败，请重试')
        setGenerating(false)
      }
    }

    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/songs"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold">AI 作曲</h1>

        <div className="mb-6 space-y-4">
          <div>
            <Label htmlFor="prompt">主题描述 *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的音乐，如：一首关于夏天的流行歌曲"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genre">风格</Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="如：流行、摇滚"
              />
            </div>
            <div>
              <Label htmlFor="mood">情绪</Label>
              <Input
                id="mood"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="如：欢快、忧伤"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="language">语言</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>创作模式 *</Label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    mode === option.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="mb-1 text-2xl">{option.icon}</div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {mode === 'existing_lyric' && (
            <div>
              <Label htmlFor="lyric">选择歌词 *</Label>
              <select
                id="lyric"
                value={selectedLyricId}
                onChange={(e) => setSelectedLyricId(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">请选择歌词</option>
                {lyrics.map((lyric) => (
                  <option key={lyric.id} value={lyric.id}>
                    {lyric.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3">
          <Link href="/songs">
            <Button variant="outline" disabled={generating}>取消</Button>
          </Link>
          <Button onClick={handleGenerate} disabled={generating}>
            <Wand2 className="mr-1 h-4 w-4" />
            {generating ? '创作中...' : '开始创作'}
          </Button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: 运行类型检查**

  Run: `pnpm type-check -- --filter=web`

  Expected: 无类型错误

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/songs/generate/page.tsx
  git commit -m "feat(web): add AI music composition page"
  ```

---

### Task 4: 在歌曲列表页增加 AI 作曲入口

**Files:**
- Modify: `apps/web/src/app/songs/page.tsx`

- [ ] **Step 1: 修改歌曲列表页**

  修改 `apps/web/src/app/songs/page.tsx`，在「新建歌曲」按钮旁增加「AI 作曲」按钮：

  ```tsx
  import { createServerClient } from '@kiyo/supabase'
  import { EmptyState, SongCard } from '@kiyo/ui'
  import Link from 'next/link'
  import { Plus, Wand2 } from 'lucide-react'

  export default async function SongsPage() {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return <div className="container mx-auto py-8">请先登录</div>
    }

    const { data: songs } = await supabase
      .from('songs')
      .select('*, lyrics(title, id)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return (
      <div className="container mx-auto py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">歌曲库</h1>
          <div className="flex gap-2">
            <Link
              href="/songs/generate"
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              <Wand2 className="h-4 w-4" />
              AI 作曲
            </Link>
            <Link
              href="/songs/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              新建歌曲
            </Link>
          </div>
        </div>

        {songs && songs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                status={song.status}
                duration={song.duration}
                lyricTitle={song.lyrics?.title ?? null}
                coverUrl={song.cover_url}
                href={`/songs/${song.id}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="暂无歌曲" description="创建你的第一首歌曲吧" />
        )}
      </div>
    )
  }
  ```

  用 `Edit` 工具替换原文件中对应的 header 部分。

- [ ] **Step 2: 运行类型检查**

  Run: `pnpm type-check -- --filter=web`

  Expected: 无类型错误

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/songs/page.tsx
  git commit -m "feat(web): add AI composition entry button on songs list"
  ```

---

### Task 5: 全量验证

- [ ] **Step 1: 运行全部测试**

  Run: `pnpm test`

  Expected: 所有测试通过

- [ ] **Step 2: 运行类型检查**

  Run: `pnpm type-check`

  Expected: 无类型错误

- [ ] **Step 3: 运行构建**

  Run: `pnpm build`

  Expected: 构建成功

- [ ] **Step 4: 最终 Commit（如有未提交的改动）**

  ```bash
  git status
  # 如有未提交文件
  git add .
  git commit -m "feat: complete AI music composition (Issue #24)"
  ```

---

## Self-Review 检查清单

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `POST /api/songs/generate` 路由 | Task 2 |
| `generateMusic` 补齐 `lyricsOptimizer` | Task 1 |
| 三种创作模式（instrumental / auto_lyrics / existing_lyric） | Task 2 (API) + Task 3 (UI) |
| 语言参数作为 prompt 注入 | Task 2 (LANGUAGE_MAP) |
| 关联已有歌词校验归属权 | Task 2 (403 测试) |
| 生成失败时 `status='failed'` | Task 2 (catch 块) |
| 前端 AI 作曲页面 | Task 3 |
| 歌曲列表入口 | Task 4 |
| 生成后自动跳转到详情页 | Task 3 (router.push) |
| 单元测试 + API 测试 | Task 1 + Task 2 |

**无 gaps，无 placeholders。**
