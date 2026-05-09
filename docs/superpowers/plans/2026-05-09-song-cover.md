# 歌曲封面生成与上传实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为歌曲添加 AI 生成封面和手动上传封面能力，重构专辑封面代码以消除重复。

**Architecture:** 提取共享封面逻辑到 `lib/cover.ts`，统一 `CoverSection` 组件支持 album/song 两种类型，统一 API 路由 `POST /api/{type}/{id}/cover?action=generate|upload`。

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Minimax AI (`@kiyo/ai`), Vitest, Tailwind CSS, shadcn/ui, next-intl

---

## 文件结构映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `supabase-local/migrations/20260509120000_add_songs_cover_status.sql` | 新建 | 为 `songs` 表添加 `cover_status` 字段 |
| `apps/web/src/lib/cover.ts` | 新建 | 共享封面工具：buildCoverPrompt / downloadImage / uploadToCovers |
| `apps/web/src/app/api/albums/[id]/cover/route.ts` | 新建 | 重构后的专辑封面路由（支持 generate + upload） |
| `apps/web/src/app/api/albums/[id]/cover/route.test.ts` | 新建 | 重构后的专辑封面测试 |
| `apps/web/src/app/api/songs/[id]/cover/route.ts` | 新建 | 歌曲封面路由（支持 generate + upload） |
| `apps/web/src/app/api/songs/[id]/cover/route.test.ts` | 新建 | 歌曲封面测试 |
| `apps/web/src/components/CoverSection.tsx` | 新建 | 通用封面组件（album/song 两用，含上传按钮） |
| `apps/web/src/app/albums/[id]/page.tsx` | 修改 | 使用新 CoverSection |
| `apps/web/src/app/songs/[id]/page.tsx` | 修改 | 插入 CoverSection |
| `apps/web/messages/zh.json` | 修改 | 添加 `songs.detail.cover` 文案 |
| `apps/web/messages/en.json` | 修改 | 添加英文翻译 |
| `apps/web/src/app/api/albums/[id]/generate-cover/route.ts` | 删除 | 旧路由被 `cover/route.ts` 替代 |
| `apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts` | 删除 | 旧测试被 `cover/route.test.ts` 替代 |
| `apps/web/src/app/albums/[id]/_components/CoverSection.tsx` | 删除 | 旧组件被 `src/components/CoverSection.tsx` 替代 |

---

### Task 1: 数据库迁移 — 添加 songs.cover_status

**Files:**
- Create: `supabase-local/migrations/20260509120000_add_songs_cover_status.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
alter table songs add column if not exists cover_status text not null default 'none';
```

- [ ] **Step 2: 应用迁移到本地 Supabase**

Run: `pnpm supabase:db:reset` 或手动应用（如果本地环境未启动则跳过，CI 会执行）

- [ ] **Step 3: 提交**

```bash
git add supabase-local/migrations/20260509120000_add_songs_cover_status.sql
git commit -m "feat(db): add cover_status to songs table"
```

---

### Task 2: 共享封面工具 — lib/cover.ts

**Files:**
- Create: `apps/web/src/lib/cover.ts`

- [ ] **Step 1: 创建共享工具文件**

```typescript
export function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  if (type === 'album') {
    return data.description
      ? `专辑: ${data.title}。${data.description}`
      : `专辑: ${data.title}`
  }
  const parts = [`歌曲: ${data.title}`]
  if (data.genre) parts.push(`风格：${data.genre}`)
  if (data.mood) parts.push(`情绪：${data.mood}`)
  return parts.join('，')
}

export async function downloadImage(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to download generated image')
  }
  return res.arrayBuffer()
}

export async function uploadToCovers(
  supabase: any,
  filePath: string,
  buffer: ArrayBuffer
): Promise<string> {
  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, buffer, { contentType: 'image/png' })
  if (error) throw error
  const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
  return data.publicUrl
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/lib/cover.ts
git commit -m "feat(cover): add shared cover utilities"
```

---

### Task 3: 重构专辑封面 API

**Files:**
- Delete: `apps/web/src/app/api/albums/[id]/generate-cover/route.ts`
- Delete: `apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts`
- Create: `apps/web/src/app/api/albums/[id]/cover/route.ts`
- Create: `apps/web/src/app/api/albums/[id]/cover/route.test.ts`

- [ ] **Step 1: 创建重构后的专辑封面路由**

```typescript
import { createServerClient } from '@kiyo/supabase/server'
import { generateImage } from '@kiyo/ai'
import { NextResponse } from 'next/server'
import { buildCoverPrompt, downloadImage, uploadToCovers } from '@/lib/cover'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { id: albumId } = await params
  const action = new URL(request.url).searchParams.get('action')

  if (!action || !['generate', 'upload'].includes(action)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing action parameter' } },
      { status: 400 }
    )
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, user_id, title, description, cover_status')
    .eq('id', albumId)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  if (album.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Album does not belong to you' } },
      { status: 403 }
    )
  }

  if (action === 'generate') {
    await supabase
      .from('albums')
      .update({ cover_status: 'generating' })
      .eq('id', albumId)

    try {
      const prompt = buildCoverPrompt('album', {
        title: album.title,
        description: album.description,
      })
      const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

      const imageBuffer = await downloadImage(imageUrl)
      const filePath = `${user.id}/${albumId}/${Date.now()}.png`
      const publicUrl = await uploadToCovers(supabase, filePath, imageBuffer)

      const { data: updatedAlbum, error: updateError } = await supabase
        .from('albums')
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', albumId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        coverUrl: publicUrl,
        coverStatus: 'completed',
        album: updatedAlbum,
      })
    } catch (error) {
      await supabase
        .from('albums')
        .update({ cover_status: 'failed' })
        .eq('id', albumId)

      const errorMessage = error instanceof Error ? error.message : 'Cover generation failed'
      const statusCode = errorMessage.includes('Minimax') || errorMessage.includes('generation') ? 422 : 500

      return NextResponse.json(
        { error: { code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR', message: errorMessage }, coverStatus: 'failed' },
        { status: statusCode }
      )
    }
  }

  // action === 'upload'
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File must be an image' } },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File size must be less than 5MB' } },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type.split('/')[1] || 'png'
    const filePath = `${user.id}/${albumId}/${Date.now()}.${ext}`
    const publicUrl = await uploadToCovers(supabase, filePath, bytes)

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', albumId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverUrl: publicUrl,
      coverStatus: 'completed',
      album: updatedAlbum,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 创建重构后的专辑测试**

```typescript
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
  generateImage: vi.fn(),
}))

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

  it('generates cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', description: 'A great album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('completed')
    expect(album.cover_url).toBe(json.coverUrl)
    expect(mockClient.uploadedFiles).toHaveLength(1)
    expect(mockClient.uploadedFiles[0].path).toMatch(/^user-1\/a1\/\d+\.png$/)
  })

  it('returns 422 when Minimax generation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockRejectedValue(new Error('Minimax generation error'))

    const request = new Request('http://localhost/api/albums/a1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
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
      body: formData,
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('completed')
    expect(album.cover_url).toBe(json.coverUrl)
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
      body: formData,
    })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
```

- [ ] **Step 3: 运行专辑测试确保通过**

Run: `pnpm --filter web test apps/web/src/app/api/albums/\[id\]/cover/route.test.ts`
Expected: 8 tests pass

- [ ] **Step 4: 删除旧文件**

```bash
rm apps/web/src/app/api/albums/[id]/generate-cover/route.ts
rm apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts
rmdir apps/web/src/app/api/albums/[id]/generate-cover
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/app/api/albums/[id]/cover/
git add apps/web/src/lib/cover.ts
git rm -r apps/web/src/app/api/albums/[id]/generate-cover
git commit -m "refactor(album-cover): unify album cover API to /cover with generate+upload"
```

---

### Task 4: 新建歌曲封面 API

**Files:**
- Create: `apps/web/src/app/api/songs/[id]/cover/route.ts`
- Create: `apps/web/src/app/api/songs/[id]/cover/route.test.ts`

- [ ] **Step 1: 创建歌曲封面路由**

```typescript
import { createServerClient } from '@kiyo/supabase/server'
import { generateImage } from '@kiyo/ai'
import { NextResponse } from 'next/server'
import { buildCoverPrompt, downloadImage, uploadToCovers } from '@/lib/cover'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { id: songId } = await params
  const action = new URL(request.url).searchParams.get('action')

  if (!action || !['generate', 'upload'].includes(action)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing action parameter' } },
      { status: 400 }
    )
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id, user_id, title, genre, mood, cover_status')
    .eq('id', songId)
    .single()

  if (songError || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (song.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Song does not belong to you' } },
      { status: 403 }
    )
  }

  if (action === 'generate') {
    await supabase
      .from('songs')
      .update({ cover_status: 'generating' })
      .eq('id', songId)

    try {
      const prompt = buildCoverPrompt('song', {
        title: song.title,
        genre: song.genre,
        mood: song.mood,
      })
      const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

      const imageBuffer = await downloadImage(imageUrl)
      const filePath = `${user.id}/${songId}/${Date.now()}.png`
      const publicUrl = await uploadToCovers(supabase, filePath, imageBuffer)

      const { data: updatedSong, error: updateError } = await supabase
        .from('songs')
        .update({ cover_url: publicUrl, cover_status: 'completed' })
        .eq('id', songId)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({
        coverUrl: publicUrl,
        coverStatus: 'completed',
        song: updatedSong,
      })
    } catch (error) {
      await supabase
        .from('songs')
        .update({ cover_status: 'failed' })
        .eq('id', songId)

      const errorMessage = error instanceof Error ? error.message : 'Cover generation failed'
      const statusCode = errorMessage.includes('Minimax') || errorMessage.includes('generation') ? 422 : 500

      return NextResponse.json(
        { error: { code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR', message: errorMessage }, coverStatus: 'failed' },
        { status: statusCode }
      )
    }
  }

  // action === 'upload'
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File must be an image' } },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File size must be less than 5MB' } },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const ext = file.type.split('/')[1] || 'png'
    const filePath = `${user.id}/${songId}/${Date.now()}.${ext}`
    const publicUrl = await uploadToCovers(supabase, filePath, bytes)

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', songId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      coverUrl: publicUrl,
      coverStatus: 'completed',
      song: updatedSong,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: errorMessage } },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: 创建歌曲封面测试**

```typescript
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
  generateImage: vi.fn(),
}))

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

  it('generates cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', genre: 'Pop', mood: 'Happy', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('completed')
    expect(song.cover_url).toBe(json.coverUrl)
    expect(mockClient.uploadedFiles).toHaveLength(1)
    expect(mockClient.uploadedFiles[0].path).toMatch(/^user-1\/s1\/\d+\.png$/)
  })

  it('returns 422 when Minimax generation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockRejectedValue(new Error('Minimax generation error'))

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('failed')
  })

  it('returns 500 when image download fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('failed')
  })

  it('returns 500 when Storage upload fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'My Song', user_id: 'user-1', cover_status: 'none' },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Storage error' } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/songs/s1/cover?action=generate', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('failed')
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
      body: formData,
    })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.cover_status).toBe('completed')
    expect(song.cover_url).toBe(json.coverUrl)
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
      body: formData,
    })
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
      body: formData,
    })
    const response = await POST(request, { params: Promise.resolve({ id: 's1' }) })

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
```

- [ ] **Step 3: 运行歌曲测试确保通过**

Run: `pnpm --filter web test apps/web/src/app/api/songs/\[id\]/cover/route.test.ts`
Expected: 11 tests pass

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/app/api/songs/[id]/cover/
git commit -m "feat(song-cover): add song cover generate and upload API"
```

---

### Task 5: 通用 CoverSection 组件

**Files:**
- Create: `apps/web/src/components/CoverSection.tsx`
- Delete: `apps/web/src/app/albums/[id]/_components/CoverSection.tsx`

- [ ] **Step 1: 创建通用 CoverSection 组件**

```tsx
'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3, Music2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface CoverSectionProps {
  entityId: string
  entityType: 'album' | 'song'
  coverUrl: string | null
  coverStatus: string
  title: string
  genre?: string | null
  mood?: string | null
}

export function CoverSection({ entityId, entityType, coverUrl, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations(entityType === 'album' ? 'albums.cover' : 'songs.detail.cover')

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const res = await fetch(`/api/${entityType}s/${entityId}/cover?action=generate`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || t('error'))
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/${entityType}s/${entityId}/cover?action=upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || t('error'))
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const buttonText =
    status === 'generating'
      ? t('generating')
      : status === 'completed'
        ? t('regenerate')
        : status === 'failed'
          ? t('retry')
          : t('generate')

  return (
    <div className="mb-6">
      <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {status === 'completed' && url ? (
          <Image src={url} alt={title} fill className="object-cover" />
        ) : status === 'generating' ? (
          <Skeleton className="h-full w-full" />
        ) : entityType === 'album' ? (
          <Disc3 className="h-24 w-24 text-muted-foreground" />
        ) : (
          <Music2 className="h-24 w-24 text-muted-foreground" />
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={handleGenerate} disabled={loading || status === 'generating'}>
          {buttonText}
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || status === 'generating'}
          variant="outline"
        >
          <Upload className="mr-1 h-4 w-4" />
          {status === 'completed' ? t('replace') : t('upload')}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: 删除旧组件**

```bash
rm apps/web/src/app/albums/[id]/_components/CoverSection.tsx
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/components/CoverSection.tsx
git rm apps/web/src/app/albums/[id]/_components/CoverSection.tsx
git commit -m "feat(cover): extract generic CoverSection with upload support"
```

---

### Task 6: 专辑详情页适配

**Files:**
- Modify: `apps/web/src/app/albums/[id]/page.tsx`

- [ ] **Step 1: 修改导入和 props**

将：
```tsx
import { CoverSection } from './_components/CoverSection'
```

替换为：
```tsx
import { CoverSection } from '@/components/CoverSection'
```

将：
```tsx
      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />
```

替换为：
```tsx
      <CoverSection
        entityId={id}
        entityType="album"
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/albums/[id]/page.tsx
git commit -m "refactor(album): use generic CoverSection component"
```

---

### Task 7: 歌曲详情页集成

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`

- [ ] **Step 1: 添加 CoverSection 导入**

在文件顶部添加：
```tsx
import { CoverSection } from '@/components/CoverSection'
```

- [ ] **Step 2: 在标题上方插入 CoverSection**

在 `<div className="mb-6 flex items-start justify-between">` 之前插入：

```tsx
      <CoverSection
        entityId={song.id}
        entityType="song"
        coverUrl={song.cover_url}
        coverStatus={song.cover_status ?? 'none'}
        title={song.title}
        genre={song.genre}
        mood={song.mood}
      />
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/app/songs/[id]/page.tsx
git commit -m "feat(song-detail): add CoverSection to song detail page"
```

---

### Task 8: i18n 文案

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 在 zh.json 的 songs.detail 下添加 cover 文案**

找到 `songs.detail` 区域（大约在第 400-430 行之间），在合适位置插入：

```json
    "cover": {
      "generate": "生成封面",
      "regenerate": "重新生成",
      "upload": "上传封面",
      "replace": "更换封面",
      "generating": "生成中...",
      "retry": "重试",
      "error": "生成失败，请重试"
    },
```

- [ ] **Step 2: 在 en.json 的 songs.detail 下添加对应英文**

```json
    "cover": {
      "generate": "Generate Cover",
      "regenerate": "Regenerate",
      "upload": "Upload Cover",
      "replace": "Replace Cover",
      "generating": "Generating...",
      "retry": "Retry",
      "error": "Generation failed, please retry"
    },
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add song cover translations"
```

---

### Task 9: 运行完整测试套件

- [ ] **Step 1: 运行专辑相关测试**

Run: `pnpm --filter web test apps/web/src/app/api/albums/`
Expected: 专辑 cover 测试 + 其他专辑测试全部通过

- [ ] **Step 2: 运行歌曲相关测试**

Run: `pnpm --filter web test apps/web/src/app/api/songs/`
Expected: 歌曲 cover 测试 + 其他歌曲测试全部通过

- [ ] **Step 3: 运行 TypeScript 检查**

Run: `pnpm type-check`
Expected: 无类型错误

- [ ] **Step 4: 运行 lint**

Run: `pnpm lint`
Expected: 无 lint 错误

- [ ] **Step 5: 最终提交（如有修复）**

```bash
git add -A
git commit -m "test: verify full test suite passes for song cover feature"
```

---

## 自检

### 1. Spec 覆盖

| Spec 要求 | 对应 Task |
|-----------|-----------|
| songs.cover_status 数据库字段 | Task 1 |
| lib/cover.ts 共享工具 | Task 2 |
| 重构专辑 API 为 /cover?action=generate\|upload | Task 3 |
| 新建歌曲 API /cover?action=generate\|upload | Task 4 |
| 通用 CoverSection 组件（album/song 两用） | Task 5 |
| 专辑详情页使用新组件 | Task 6 |
| 歌曲详情页插入 CoverSection | Task 7 |
| i18n 文案 | Task 8 |
| 完整测试覆盖 | Task 3, 4, 9 |

**无遗漏。**

### 2. Placeholder 扫描

检查计划全文，未发现以下反模式：
- ❌ "TBD", "TODO", "implement later"
- ❌ "Add appropriate error handling"（具体代码已提供）
- ❌ "Write tests for the above"（具体测试代码已提供）
- ❌ "Similar to Task N"（每个任务代码完整独立）
- ❌ 无代码的步骤描述（每个代码步骤都含完整代码块）

### 3. 类型一致性

- `CoverSectionProps` 中 `entityType: 'album' | 'song'` 与所有调用处一致
- `buildCoverPrompt(type, data)` 签名在 `lib/cover.ts`、专辑 API、歌曲 API 中一致
- `uploadToCovers(supabase, filePath, buffer)` 参数顺序在所有调用处一致
- API 路由返回结构 `{ coverUrl, coverStatus, album/song }` 与测试断言一致

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-09-song-cover.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?