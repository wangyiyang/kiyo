# 专辑详情页支持添加歌曲（Issue #38）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在专辑详情页增加"添加歌曲"入口，支持从用户歌曲库中多选未加入本专辑的歌曲进行增量添加。

**Architecture:** 新增独立 POST API 路由负责增量插入与 order_index 计算；复用并扩展现有 SongSelector 组件；新增 AddSongsDialog 弹窗封装交互；专辑详情页引入弹窗并传入已存在歌曲的 excludeIds。

**Tech Stack:** Next.js App Router, Supabase, React, shadcn/ui, dnd-kit, Vitest

---

## 文件结构

| 文件路径 | 操作 | 职责 |
|----------|------|------|
| `apps/web/src/app/api/albums/[id]/songs/route.ts` | 新建 | POST handler：校验、查最大 order_index、增量插入 |
| `apps/web/src/app/api/albums/[id]/songs/route.test.ts` | 新建 | API 单元测试（200/400/401/403/404） |
| `apps/web/src/app/albums/_components/SongSelector.tsx` | 编辑 | 添加 `excludeIds`、`emptyMessage` props |
| `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx` | 新建 | Dialog 弹窗，调用 API，刷新页面 |
| `apps/web/src/app/albums/[id]/page.tsx` | 编辑 | 引入 AddSongsDialog，传入 `excludeIds` |

---

### Task 1: 扩展 SongSelector（添加 excludeIds + emptyMessage）

**Files:**
- Modify: `apps/web/src/app/albums/_components/SongSelector.tsx`

- [ ] **Step 1: 修改组件接口和渲染逻辑**

将 `SongSelectorProps` 扩展两个可选 prop，并在渲染时将 `excludeIds` 的歌曲从列表中过滤掉。

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Input, SongRow } from '@kiyo/ui'

interface Song {
  id: string
  title: string
}

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  excludeIds?: string[]
  emptyMessage?: string
}

export function SongSelector({ selectedIds, onChange, excludeIds, emptyMessage }: SongSelectorProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/songs')
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs ?? [])
        setLoading(false)
      })
  }, [])

  const filteredSongs = songs
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => !excludeIds?.includes(s.id))

  function toggleSong(id: string, selected: boolean) {
    if (selected) {
      onChange([...selectedIds, id])
    } else {
      onChange(selectedIds.filter((sid) => sid !== id))
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-3">
      <Input
        placeholder="搜索歌曲..."
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.map((song) => (
          <SongRow
            key={song.id}
            id={song.id}
            title={song.title}
            mode="select"
            selected={selectedIds.includes(song.id)}
            onSelect={toggleSong}
          />
        ))}
        {filteredSongs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? '没有找到匹配的歌曲'}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">已选择 {selectedIds.length} 首歌曲</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/albums/_components/SongSelector.tsx
git commit -m "feat(albums): add excludeIds and emptyMessage props to SongSelector"
```

---

### Task 2: 创建 API 路由 POST /api/albums/:id/songs

**Files:**
- Create: `apps/web/src/app/api/albums/[id]/songs/route.ts`

- [ ] **Step 1: 新建路由文件**

创建目录并写入 POST handler：

```bash
mkdir -p apps/web/src/app/api/albums/\[id\]/songs
```

写入 `apps/web/src/app/api/albums/[id]/songs/route.ts`：

```ts
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: { song_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { song_ids } = body

  if (!Array.isArray(song_ids) || song_ids.length === 0 || !song_ids.every((id) => typeof id === 'string')) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'song_ids must be a non-empty array of strings' } },
      { status: 400 }
    )
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  const { data: ownedSongs, error: songsError } = await supabase
    .from('songs')
    .select('id')
    .eq('user_id', user.id)
    .in('id', song_ids)

  if (songsError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: songsError.message } },
      { status: 500 }
    )
  }

  if (!ownedSongs || ownedSongs.length !== song_ids.length) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Some songs are not owned by you' } },
      { status: 403 }
    )
  }

  const { data: maxRow } = await supabase
    .from('album_songs')
    .select('order_index')
    .eq('album_id', params.id)
    .order('order_index', { ascending: false })
    .limit(1)
    .single()

  const maxOrderIndex = maxRow?.order_index ?? -1

  const albumSongs = song_ids.map((songId, index) => ({
    album_id: params.id,
    song_id: songId,
    order_index: maxOrderIndex + 1 + index,
  }))

  const { error: insertError } = await supabase
    .from('album_songs')
    .insert(albumSongs)

  if (insertError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: insertError.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ added: song_ids.length })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/songs/route.ts
git commit -m "feat(api): add POST /albums/:id/songs route for adding songs to album"
```

---

### Task 3: 编写 API 单元测试

**Files:**
- Create: `apps/web/src/app/api/albums/[id]/songs/route.test.ts`

- [ ] **Step 1: 新建测试文件**

写入 `apps/web/src/app/api/albums/[id]/songs/route.test.ts`：

```ts
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

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/albums/[id]/songs', () => {
  it('adds songs to album successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's3', order_index: 0 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.added).toBe(2)

    const albumSongs = mockClient.dataStore.album_songs.filter((as) => as.album_id === 'a1')
    expect(albumSongs).toHaveLength(3)
    const s1Entry = albumSongs.find((as) => as.song_id === 's1')
    const s2Entry = albumSongs.find((as) => as.song_id === 's2')
    expect(s1Entry?.order_index).toBe(1)
    expect(s2Entry?.order_index).toBe(2)
  })

  it('returns 400 for empty song_ids array', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: [] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when song_ids contain non-owned songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/songs', {
      method: 'POST',
      body: JSON.stringify({ song_ids: ['s1'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request, { params: { id: 'a1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

```bash
cd apps/web && pnpm test -- src/app/api/albums/\[id\]/songs/route.test.ts
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/songs/route.test.ts
git commit -m "test(api): add unit tests for POST /albums/:id/songs"
```

---

### Task 4: 创建 AddSongsDialog 组件

**Files:**
- Create: `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx`

- [ ] **Step 1: 新建组件文件**

写入 `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx`：

```tsx
'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui'
import { SongSelector } from '../../_components/SongSelector'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AddSongsDialogProps {
  albumId: string
  excludeIds: string[]
}

export function AddSongsDialog({ albumId, excludeIds }: AddSongsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit() {
    if (selectedIds.length === 0) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: selectedIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? '添加失败')
      }

      setOpen(false)
      setSelectedIds([])
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          添加歌曲
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加歌曲到专辑</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SongSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            excludeIds={excludeIds}
            emptyMessage="暂无可用歌曲"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? '添加中...' : `添加 (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/albums/\[id\]/_components/AddSongsDialog.tsx
git commit -m "feat(albums): add AddSongsDialog component"
```

---

### Task 5: 在专辑详情页引入 AddSongsDialog

**Files:**
- Modify: `apps/web/src/app/albums/[id]/page.tsx`

- [ ] **Step 1: 编辑页面文件**

在 `apps/web/src/app/albums/[id]/page.tsx` 顶部添加导入：

```tsx
import { AddSongsDialog } from './_components/AddSongsDialog'
```

将"歌曲列表"标题栏部分替换为：

```tsx
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">歌曲列表</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{songs.length} 首歌曲</span>
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
      </div>
```

完整修改后的 `page.tsx` 应如下所示（保留其余不变内容）：

```tsx
import { createServerClient } from '@kiyo/supabase'
import { EmptyState } from '@kiyo/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DraggableSongList } from '../_components/DraggableSongList'
import { CoverSection } from './_components/CoverSection'
import { AddSongsDialog } from './_components/AddSongsDialog'

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(*)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs).filter(Boolean)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/albums" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回专辑列表
        </Link>
      </div>

      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">歌曲列表</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{songs.length} 首歌曲</span>
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
      </div>

      {songs.length > 0 ? (
        <DraggableSongList
          songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
          albumId={id}
        />
      ) : (
        <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd apps/web && pnpm type-check
```

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/albums/\[id\]/page.tsx
git commit -m "feat(albums): wire AddSongsDialog into album detail page"
```

---

## Self-Review

### 1. Spec coverage

- [x] 新增 `POST /api/albums/:id/songs` API — Task 2
- [x] API 测试覆盖（200/400/401/403/404）— Task 3
- [x] `SongSelector` 支持 `excludeIds` 过滤 — Task 1
- [x] `AddSongsDialog` 弹窗组件 — Task 4
- [x] 专辑详情页添加"添加歌曲"按钮 — Task 5
- [x] 自动计算 `order_index` — Task 2 中 `maxOrderIndex + 1 + index`
- [x] 添加后 `router.refresh()` 实时更新 — Task 4

### 2. Placeholder scan

无 TBD、TODO、"implement later" 或模糊描述。

### 3. Type consistency

- `excludeIds` 类型始终为 `string[]`
- `emptyMessage` 类型始终为 `string | undefined`
- API 参数名 `song_ids` 在路由、测试、前端中一致
- `order_index` 计算逻辑在 spec 和实现中一致

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-08-album-add-songs.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
