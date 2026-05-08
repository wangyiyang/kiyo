# AI 翻唱（Voice Cover）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Issue #25 的 AI 翻唱功能，支持从已有歌曲或上传音频发起翻唱，选择预设风格后生成新歌曲。

**Architecture:** 独立翻唱页 `/songs/cover` 支持两种音频来源（选择已有歌曲 / 上传文件）→ `POST /api/songs/cover` 创建记录并同步调用 Minimax `music-cover` → 下载上传音频 → 返回 song → 跳转详情页。详情页增加翻唱入口、AI 翻唱标签和原曲对比播放器。

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Minimax API, Supabase, Tailwind CSS

---

## 文件结构

| 文件 | 职责 | 操作 |
|------|------|------|
| `supabase/migrations/20260508140001_extend_songs_for_cover.sql` | 添加 `original_song_id`、`voice_style`，扩展 `source` 约束 | 新建 |
| `packages/ai/src/cover.ts` | `generateCover` 函数，调用 Minimax music-cover | 新建 |
| `packages/ai/src/__tests__/cover.test.ts` | `generateCover` 单元测试 | 新建 |
| `packages/ai/index.ts` | 导出 `generateCover` | 修改 |
| `apps/web/src/app/api/songs/cover/route.ts` | `POST /api/songs/cover` 路由 | 新建 |
| `apps/web/src/app/api/songs/cover/route.test.ts` | API 路由测试 | 新建 |
| `apps/web/src/app/songs/cover/page.tsx` | 翻唱表单页面 | 新建 |
| `apps/web/src/app/songs/[id]/page.tsx` | 增加翻唱按钮、AI 翻唱标签、对比播放器 | 修改 |

---

### Task 1: 数据库迁移

**Files:**
- Create: `supabase/migrations/20260508140001_extend_songs_for_cover.sql`

- [ ] **Step 1: 创建迁移文件**

  创建 `supabase/migrations/20260508140001_extend_songs_for_cover.sql`：

  ```sql
  -- 添加 original_song_id 自引用外键
  alter table songs add column original_song_id uuid references songs(id) on delete set null;

  -- 添加 voice_style 字段记录翻唱风格
  alter table songs add column voice_style text;

  -- 扩展 source 约束，增加 ai_cover
  alter table songs drop constraint songs_source_check;
  alter table songs add constraint songs_source_check
    check (source in ('manual', 'ai_generated', 'ai_cover'));
  ```

- [ ] **Step 2: 应用迁移（本地开发环境）**

  Run: `supabase db reset`

  Expected: 迁移成功应用，无错误

- [ ] **Step 3: Commit**

  ```bash
  git add supabase/migrations/20260508140001_extend_songs_for_cover.sql
  git commit -m "feat(db): add original_song_id and voice_style for AI cover"
  ```

---

### Task 2: AI 服务层 — generateCover

**Files:**
- Create: `packages/ai/src/cover.ts`
- Create: `packages/ai/src/__tests__/cover.test.ts`
- Modify: `packages/ai/index.ts`

- [ ] **Step 1: 写测试 — generateCover 成功路径和错误处理**

  创建 `packages/ai/src/__tests__/cover.test.ts`：

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
  import { generateCover } from '../cover'
  import { MinimaxError } from '../errors'

  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.MINIMAX_API_KEY = 'test-key'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env.MINIMAX_API_KEY
  })

  describe('generateCover', () => {
    it('returns audioUrl and duration on success', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/cover.mp3', status: 1 },
          extra_info: { music_duration: 180000 },
        }),
      } as Response)

      const result = await generateCover({
        voiceStyle: '爵士钢琴版，慵懒萨克斯，舒缓节奏',
        audioUrl: 'https://example.com/original.mp3',
      })

      expect(result.audioUrl).toBe('https://cdn.minimaxi.com/audio/cover.mp3')
      expect(result.duration).toBe(180)
    })

    it('sends correct request body to music-cover endpoint', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { audio: 'https://cdn.minimaxi.com/audio/cover.mp3', status: 1 },
          extra_info: { music_duration: 120000 },
        }),
      } as Response)

      await generateCover({
        voiceStyle: '流行摇滚版，节奏更快',
        audioUrl: 'https://example.com/song.mp3',
      })

      const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(callArgs[1].body)
      expect(body.model).toBe('music-cover')
      expect(body.prompt).toBe('流行摇滚版，节奏更快')
      expect(body.audio_url).toBe('https://example.com/song.mp3')
      expect(body.output_format).toBe('url')
      expect(body.audio_setting).toEqual({
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      })
    })

    it('throws MinimaxError when API returns no audio', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
      } as Response)

      await expect(
        generateCover({ voiceStyle: 'test', audioUrl: 'https://example.com/test.mp3' })
      ).rejects.toBeInstanceOf(MinimaxError)
    })
  })
  ```

- [ ] **Step 2: 运行测试，确认失败**

  Run: `pnpm test -- --filter=@kiyo/ai`

  Expected: 全部失败，`generateCover` 未定义

- [ ] **Step 3: 实现 generateCover**

  创建 `packages/ai/src/cover.ts`：

  ```typescript
  import { minimaxFetch } from './client'
  import { MinimaxError } from './errors'

  export interface GenerateCoverOptions {
    voiceStyle: string
    audioUrl: string
  }

  export interface GenerateCoverResult {
    audioUrl: string
    duration: number
  }

  export async function generateCover(
    options: GenerateCoverOptions
  ): Promise<GenerateCoverResult> {
    const body = {
      model: 'music-cover',
      prompt: options.voiceStyle,
      audio_url: options.audioUrl,
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
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
      throw new MinimaxError('Invalid response from cover API', 'api_error')
    }

    const durationMs = data.extra_info?.music_duration ?? 0
    const durationSeconds = Math.round(durationMs / 1000)

    return {
      audioUrl: data.data.audio,
      duration: durationSeconds,
    }
  }
  ```

- [ ] **Step 4: 更新 index.ts 导出**

  修改 `packages/ai/index.ts`，在末尾追加：

  ```typescript
  export { generateCover } from './src/cover'
  export type { GenerateCoverOptions, GenerateCoverResult } from './src/cover'
  ```

- [ ] **Step 5: 运行测试，确认通过**

  Run: `pnpm test -- --filter=@kiyo/ai`

  Expected: 所有测试通过（包括现有 music/text/image 测试）

- [ ] **Step 6: Commit**

  ```bash
  git add packages/ai/
  git commit -m "feat(ai): add generateCover for Minimax music-cover"
  ```

---

### Task 3: API 路由 — POST /api/songs/cover

**Files:**
- Create: `apps/web/src/app/api/songs/cover/route.ts`
- Create: `apps/web/src/app/api/songs/cover/route.test.ts`

- [ ] **Step 1: 写测试 — 成功路径和错误场景**

  创建 `apps/web/src/app/api/songs/cover/route.test.ts`：

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
    generateCover: vi.fn(),
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

  describe('POST /api/songs/cover', () => {
    it('creates cover song from existing song (200)', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
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

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({
          voice_style: '爵士钢琴版，慵懒萨克斯',
          audio_url: 'https://example.com/original.mp3',
          original_song_id: 's1',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.song.status).toBe('completed')
      expect(json.song.source).toBe('ai_cover')
      expect(json.song.original_song_id).toBe('s1')
      expect(json.song.voice_style).toBe('爵士钢琴版，慵懒萨克斯')
      expect(mockClient.dataStore.songs).toHaveLength(2)
    })

    it('creates cover song from uploaded audio (200)', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
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

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({
          voice_style: '流行摇滚版',
          audio_url: 'https://mock-cdn.supabase.co/audio-uploads/user-1/test.mp3',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json.song.status).toBe('completed')
      expect(json.song.source).toBe('ai_cover')
      expect(json.song.original_song_id).toBeNull()
    })

    it('returns 401 when not authenticated', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: undefined })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({ voice_style: 'test', audio_url: 'https://example.com/test.mp3' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('returns 400 for invalid voice_style length', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({ voice_style: '短', audio_url: 'https://example.com/test.mp3' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 400 when original song has no audio_url', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      mockClient.dataStore.songs = [
        { id: 's1', title: '原曲', user_id: 'user-1', audio_url: null },
      ]
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({
          voice_style: '流行摇滚版',
          audio_url: 'https://example.com/original.mp3',
          original_song_id: 's1',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('returns 422 and sets failed status when Minimax fails', async () => {
      const { createServerClient } = await import('@kiyo/supabase')
      const { generateCover, MinimaxError } = await import('@kiyo/ai')
      const mockClient = createMockSupabaseClient({ userId: 'user-1' })
      vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
      vi.mocked(generateCover).mockRejectedValue(new MinimaxError('Cover failed', 'api_error'))

      const request = new Request('http://localhost/api/songs/cover', {
        method: 'POST',
        body: JSON.stringify({
          voice_style: '流行摇滚版',
          audio_url: 'https://example.com/test.mp3',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      expect(response.status).toBe(422)
      const json = await response.json()
      expect(json.error.code).toBe('GENERATION_FAILED')

      const song = mockClient.dataStore.songs[0]
      expect(song.status).toBe('failed')
    })
  })
  ```

- [ ] **Step 2: 运行测试，确认失败**

  Run: `pnpm test -- --filter=web -- apps/web/src/app/api/songs/cover/route.test.ts`

  Expected: 全部失败，路由文件不存在

- [ ] **Step 3: 实现路由**

  创建 `apps/web/src/app/api/songs/cover/route.ts`：

  ```typescript
  import { createServerClient } from '@kiyo/supabase'
  import { generateCover, MinimaxError } from '@kiyo/ai'
  import { NextResponse } from 'next/server'

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

    const { voice_style, audio_url, original_song_id, title } = body

    if (!voice_style || typeof voice_style !== 'string' || voice_style.length < 10 || voice_style.length > 300) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'voice_style must be between 10 and 300 characters' } },
        { status: 400 }
      )
    }

    if (!audio_url || typeof audio_url !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'audio_url is required' } },
        { status: 400 }
      )
    }

    let originalSong: { title: string; lyric_id: string | null; audio_url: string | null } | null = null

    if (original_song_id && typeof original_song_id === 'string') {
      const { data: song, error: songError } = await supabase
        .from('songs')
        .select('title, lyric_id, audio_url, user_id')
        .eq('id', original_song_id)
        .eq('user_id', user.id)
        .single()

      if (songError || !song) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Original song not found' } },
          { status: 404 }
        )
      }

      if (!song.audio_url) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: '原歌曲没有可用音频' } },
          { status: 400 }
        )
      }

      originalSong = song
    }

    const songTitle = typeof title === 'string' && title.trim()
      ? title.trim()
      : originalSong
        ? `${originalSong.title} 的翻唱`
        : 'AI 翻唱作品'

    const { data: song, error: insertError } = await supabase
      .from('songs')
      .insert({
        title: songTitle.slice(0, 200),
        lyric_id: originalSong?.lyric_id ?? null,
        status: 'generating',
        source: 'ai_cover',
        original_song_id: typeof original_song_id === 'string' ? original_song_id : null,
        voice_style: voice_style,
        user_id: user.id,
      })
      .select()
      .single()

    if (insertError || !song) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: insertError?.message ?? 'Failed to create song' } },
        { status: 500 }
      )
    }

    try {
      const result = await generateCover({
        voiceStyle: voice_style,
        audioUrl: audio_url as string,
      })

      const audioResponse = await fetch(result.audioUrl)
      if (!audioResponse.ok) {
        throw new Error('Failed to download audio')
      }
      const audioBuffer = await audioResponse.arrayBuffer()

      const filePath = `${user.id}/${song.id}/${Date.now()}.mp3`
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

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
      const message = err instanceof Error ? err.message : 'Cover generation failed'

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

  Run: `pnpm test -- --filter=web -- apps/web/src/app/api/songs/cover/route.test.ts`

  Expected: 所有 6 个测试通过

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/api/songs/cover/
  git commit -m "feat(api): add POST /api/songs/cover for AI voice cover"
  ```

---

### Task 4: 前端翻唱页面 — /songs/cover

**Files:**
- Create: `apps/web/src/app/songs/cover/page.tsx`

- [ ] **Step 1: 创建翻唱页面**

  创建 `apps/web/src/app/songs/cover/page.tsx`：

  ```tsx
  'use client'

  import * as React from 'react'
  import { useRouter, useSearchParams } from 'next/navigation'
  import { Button, Input, Label } from '@kiyo/ui'
  import { ArrowLeft, Mic2, Upload } from 'lucide-react'
  import Link from 'next/link'
  import { createBrowserClient } from '@kiyo/supabase'

  type SourceMode = 'existing' | 'upload'

  const STYLE_OPTIONS = [
    { icon: '🎸', label: '流行摇滚版', prompt: '流行摇滚版，节奏更快，电吉他驱动' },
    { icon: '🎷', label: '爵士钢琴版', prompt: '爵士钢琴版，慵懒萨克斯，舒缓节奏' },
    { icon: '🎻', label: '民谣吉他版', prompt: '民谣吉他版，指弹吉他，亲密人声' },
    { icon: '🎹', label: '电子舞曲版', prompt: '电子舞曲版，强烈节拍，合成器铺底' },
    { icon: '🎺', label: '古典管弦版', prompt: '古典管弦版，弦乐编排，庄重氛围' },
    { icon: '🌙', label: 'Lo-fi 放松版', prompt: 'Lo-fi 放松版，黑胶噪点，梦幻氛围' },
    { icon: '🤘', label: '摇滚金属版', prompt: '摇滚金属版，失真吉他，强力鼓组' },
    { icon: '🎤', label: '灵魂乐版', prompt: '灵魂乐版，情感充沛，即兴唱腔' },
  ]

  export default function CoverSongPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createBrowserClient()

    const prefillSongId = searchParams.get('original_song_id')

    const [sourceMode, setSourceMode] = React.useState<SourceMode>(prefillSongId ? 'existing' : 'existing')
    const [selectedSongId, setSelectedSongId] = React.useState(prefillSongId || '')
    const [songs, setSongs] = React.useState<{ id: string; title: string }[]>([])
    const [uploadedUrl, setUploadedUrl] = React.useState('')
    const [uploading, setUploading] = React.useState(false)
    const [selectedStyle, setSelectedStyle] = React.useState('')
    const [customTitle, setCustomTitle] = React.useState('')
    const [generating, setGenerating] = React.useState(false)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        supabase
          .from('songs')
          .select('id, title')
          .eq('user_id', user.id)
          .not('audio_url', 'is', null)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            if (data) setSongs(data)
          })
      })
    }, [supabase])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > 50 * 1024 * 1024) {
        setError('文件大小不能超过 50MB')
        return
      }

      setUploading(true)
      setError('')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('请先登录')
        setUploading(false)
        return
      }

      const path = `audio-uploads/${user.id}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('audio').upload(path, file, {
        contentType: file.type,
      })

      if (uploadError) {
        setError(`上传失败: ${uploadError.message}`)
        setUploading(false)
        return
      }

      const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
      setUploadedUrl(publicUrl.publicUrl)
      setUploading(false)
    }

    const handleGenerate = async () => {
      const audioUrl = sourceMode === 'existing'
        ? songs.find((s) => s.id === selectedSongId)?.audio_url || ''
        : uploadedUrl

      if (!audioUrl) {
        setError(sourceMode === 'existing' ? '请选择一首已有歌曲' : '请上传音频文件')
        return
      }

      if (!selectedStyle) {
        setError('请选择翻唱风格')
        return
      }

      setGenerating(true)
      setError('')

      try {
        const res = await fetch('/api/songs/cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voice_style: selectedStyle,
            audio_url: audioUrl,
            original_song_id: sourceMode === 'existing' ? selectedSongId || null : null,
            title: customTitle.trim() || undefined,
          }),
        })

        const data = await res.json()
        if (res.ok && data.song) {
          router.push(`/songs/${data.song.id}`)
        } else {
          setError(data.error?.message || '翻唱失败，请重试')
          setGenerating(false)
        }
      } catch {
        setError('翻唱失败，请重试')
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

        <h1 className="mb-6 text-2xl font-bold">AI 翻唱</h1>

        <div className="mb-6 space-y-4">
          {/* 来源选择 */}
          <div>
            <Label>参考音频来源</Label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('existing')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                  sourceMode === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Mic2 className="h-4 w-4" />
                选择已有歌曲
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                  sourceMode === 'upload'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Upload className="h-4 w-4" />
                上传音频
              </button>
            </div>
          </div>

          {/* 已有歌曲选择 */}
          {sourceMode === 'existing' && (
            <div>
              <Label htmlFor="song-select">选择歌曲</Label>
              <select
                id="song-select"
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">请选择一首歌曲</option>
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title}
                  </option>
                ))}
              </select>
              {songs.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  暂无可用歌曲，请先创建并生成音乐
                </p>
              )}
            </div>
          )}

          {/* 文件上传 */}
          {sourceMode === 'upload' && (
            <div>
              <Label htmlFor="audio-upload">上传音频</Label>
              <input
                id="audio-upload"
                type="file"
                accept="audio/mpeg,audio/wav,audio/flac"
                onChange={handleFileUpload}
                disabled={uploading}
                className="mt-1 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
              {uploadedUrl && (
                <p className="mt-1 text-xs text-green-600">音频已上传</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                支持 MP3、WAV、FLAC，最大 50MB
              </p>
            </div>
          )}

          {/* 风格选择 */}
          <div>
            <Label>翻唱风格 *</Label>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STYLE_OPTIONS.map((style) => (
                <button
                  key={style.prompt}
                  type="button"
                  onClick={() => setSelectedStyle(style.prompt)}
                  className={`rounded-lg border p-3 text-center transition-colors ${
                    selectedStyle === style.prompt
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="mb-1 text-2xl">{style.icon}</div>
                  <div className="text-xs font-medium">{style.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 自定义标题 */}
          <div>
            <Label htmlFor="title">作品标题（可选）</Label>
            <Input
              id="title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="留空将自动生成标题"
            />
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3">
          <Link href="/songs">
            <Button variant="outline" disabled={generating}>取消</Button>
          </Link>
          <Button onClick={handleGenerate} disabled={generating || uploading}>
            {generating ? '翻唱中...' : '开始翻唱'}
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
  git add apps/web/src/app/songs/cover/page.tsx
  git commit -m "feat(web): add AI voice cover page with style selection and upload"
  ```

---

### Task 5: 歌曲详情页增强

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`

- [ ] **Step 1: 修改详情页**

  读取当前 `apps/web/src/app/songs/[id]/page.tsx` 内容，然后进行以下替换：

  **A. 在 imports 中增加 `Mic2`：**

  ```tsx
  import { ArrowLeft, Pencil, Play, AlertCircle, Mic2 } from 'lucide-react'
  ```

  **B. 在「编辑」按钮旁增加「AI 翻唱」按钮：**

  找到这段代码：

  ```tsx
          <Link href={`/songs/${song.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-4 w-4" />
              编辑
            </Button>
          </Link>
  ```

  替换为：

  ```tsx
          <div className="flex items-center gap-2">
            {song.status === 'completed' && song.audio_url && (
              <Link href={`/songs/cover?original_song_id=${song.id}`}>
                <Button variant="outline" size="sm">
                  <Mic2 className="mr-1 h-4 w-4" />
                  AI 翻唱
                </Button>
              </Link>
            )}
            <Link href={`/songs/${song.id}/edit`}>
              <Button variant="outline" size="sm">
                <Pencil className="mr-1 h-4 w-4" />
                编辑
              </Button>
            </Link>
          </div>
  ```

  **C. 修改来源标签，增加 AI 翻唱：**

  找到这段代码：

  ```tsx
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {song.source === 'ai_generated' ? 'AI 生成' : '手动创建'}
            </span>
  ```

  替换为：

  ```tsx
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : song.source === 'ai_cover'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {song.source === 'ai_generated' ? 'AI 生成' : song.source === 'ai_cover' ? 'AI 翻唱' : '手动创建'}
            </span>
  ```

  **D. 在音频预览下方增加翻唱风格信息和对比原曲（如果是翻唱作品）：**

  找到 `song.ai_prompt` 那段代码的开头：

  ```tsx
      {song.ai_prompt && (
  ```

  在其前面插入：

  ```tsx
      {song.source === 'ai_cover' && song.voice_style && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">翻唱风格</h2>
          <p className="text-sm text-muted-foreground">{song.voice_style}</p>
        </div>
      )}

      {song.source === 'ai_cover' && song.original_song_id && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">对比原曲</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">原曲</p>
              <AudioPlayer src={song.original_song?.audio_url || ''} className="w-full" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">翻唱</p>
              <AudioPlayer src={song.audio_url || ''} className="w-full" />
            </div>
          </div>
        </div>
      )}
  ```

  **E. 修改 Supabase 查询，关联原歌曲：**

  找到这段代码：

  ```tsx
    const { data: song } = await supabase
      .from('songs')
      .select('*, lyrics(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
  ```

  替换为：

  ```tsx
    const { data: song } = await supabase
      .from('songs')
      .select('*, lyrics(*), original_song:original_song_id(*)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()
  ```

- [ ] **Step 2: 运行类型检查**

  Run: `pnpm type-check -- --filter=web`

  Expected: 无类型错误

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/songs/\[id\]/page.tsx
  git commit -m "feat(web): add AI cover button, badge, and original comparison on song detail"
  ```

---

## Self-Review

**1. Spec coverage:**
- ✅ 两种音频来源（已有歌曲 / 上传）→ Task 4 页面实现
- ✅ 8 种预设风格 → Task 4 STYLE_OPTIONS
- ✅ `POST /api/songs/cover` → Task 3
- ✅ `generateCover` AI 服务 → Task 2
- ✅ `source='ai_cover'` → Task 3 路由
- ✅ `original_song_id` 关联 → Task 1 迁移 + Task 3 路由
- ✅ 翻唱结果对比原曲 → Task 5 详情页
- ✅ 详情页翻唱入口 → Task 5
- ✅ 失败回滚 `status='failed'` → Task 3 路由错误处理

**2. Placeholder scan:** 无 TBD、TODO、"implement later"。所有代码完整。

**3. Type consistency:**
- `GenerateCoverOptions` / `GenerateCoverResult` 在 Task 2 定义，Task 3 路由中使用
- `voice_style` 字段名在迁移、API、前端中一致
- `original_song_id` 在迁移、API、前端查询中一致

---

## 验证命令（全部完成后运行）

```bash
# AI 包测试
pnpm test -- --filter=@kiyo/ai

# Web API 测试
pnpm test -- --filter=web

# 类型检查
pnpm type-check
```
