# Audio Export (MP3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持用户从歌曲详情页导出已完成的歌曲为 MP3 文件，通过签名链接安全下载。

**Architecture:** 新增 `songs.file_path` 字段存储 Storage 路径；AI 生成时同时写入 `file_path`；导出 API 生成 5 分钟过期的签名下载链接；前端弹窗确认后触发下载。

**Tech Stack:** Next.js App Router, Supabase Storage signed URLs, shadcn/ui Dialog, lucide-react

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase-local/migrations/20260508150001_add_songs_file_path.sql` | Create | 新增 `file_path` 字段 + 数据回填 |
| `apps/web/src/app/api/songs/generate/route.ts` | Modify | AI 生成时同时写入 `file_path` |
| `apps/web/src/app/api/songs/[id]/export/route.ts` | Create | 导出签名链接 API |
| `apps/web/src/app/api/songs/[id]/export/route.test.ts` | Create | 导出 API 测试 |
| `apps/web/src/app/songs/[id]/export-dialog.tsx` | Create | 导出弹窗 Client Component |
| `apps/web/src/app/songs/[id]/page.tsx` | Modify | 引入 ExportDialog 按钮 |

---

### Task 1: 数据库迁移 — 新增 `file_path` 字段

**Files:**
- Create: `supabase-local/migrations/20260508150001_add_songs_file_path.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- 新增 file_path 字段，用于存储 Supabase Storage 中的文件路径
alter table songs add column file_path text;

-- 回填：将现有 audio_url 转为 file_path
-- 假设 audio_url 格式为 https://host/storage/v1/object/public/audio/{user_id}/{song_id}/{timestamp}.mp3
update songs
set file_path = regexp_replace(
  audio_url,
  '^https?://[^/]+/storage/v1/object/public/audio/',
  ''
)
where audio_url is not null and file_path is null;
```

- [ ] **Step 2: Commit**

```bash
git add supabase-local/migrations/20260508150001_add_songs_file_path.sql
git commit -m "feat(db): add file_path column to songs table"
```

---

### Task 2: AI 生成时同时写入 `file_path`

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`

在 Storage upload 成功后的 `update` 调用中，增加 `file_path: filePath`。

- [ ] **Step 1: 找到 update 代码块并添加 `file_path`**

在 `route.ts` 中，找到这段代码：

```ts
    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: publicUrl.publicUrl,
        duration: result.duration,
        status: 'completed',
        source: 'ai_generated',
      })
```

修改为：

```ts
    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: publicUrl.publicUrl,
        file_path: filePath,
        duration: result.duration,
        status: 'completed',
        source: 'ai_generated',
      })
```

> `filePath` 变量在 upload 前已定义：`const filePath = \`${user.id}/${song.id}/${Date.now()}.mp3\``

- [ ] **Step 2: 运行现有测试确保未破坏生成逻辑**

```bash
cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/songs/generate/route.test.ts
```
Expected: 8 tests passing

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/generate/route.ts
git commit -m "feat(api): store file_path when generating songs"
```

---

### Task 3: 创建导出 API

**Files:**
- Create: `apps/web/src/app/api/songs/[id]/export/route.ts`
- Create: `apps/web/src/app/api/songs/[id]/export/route.test.ts`

- [ ] **Step 1: 创建导出 API**

```ts
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

function parseFilePathFromUrl(audioUrl: string): string | null {
  try {
    const url = new URL(audioUrl)
    const pathParts = url.pathname.split('/')
    const audioIndex = pathParts.indexOf('audio')
    if (audioIndex === -1) return null
    return pathParts.slice(audioIndex + 1).join('/')
  } catch {
    return null
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .select('id, title, status, file_path, audio_url')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (song.status !== 'completed') {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Song is not completed yet' } },
      { status: 400 }
    )
  }

  const filePath = song.file_path || parseFilePathFromUrl(song.audio_url || '')

  if (!filePath) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'No audio file available' } },
      { status: 400 }
    )
  }

  const { data: signedData, error: signedError } = await supabase
    .storage
    .from('audio')
    .createSignedUrl(filePath, 300) // 5 minutes

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate download link' } },
      { status: 500 }
    )
  }

  const filename = `${sanitizeFilename(song.title)}.mp3`

  return NextResponse.json({
    downloadUrl: signedData.signedUrl,
    filename,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  })
}
```

- [ ] **Step 2: 创建测试文件**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

describe('GET /api/songs/:id/export', () => {
  it('returns signed download URL for completed song with file_path (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'My Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: 'user-1/s1/1234567890.mp3',
        audio_url: 'https://mock.supabase.co/storage/v1/object/public/audio/user-1/s1/1234567890.mp3',
      },
    ]
    // Mock storage.createSignedUrl
    mockClient.storage.from = vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://mock.supabase.co/storage/v1/object/sign/audio/user-1/s1/1234567890.mp3?token=abc123' },
        error: null,
      }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.filename).toBe('My Song.mp3')
    expect(json.downloadUrl).toContain('sign/audio')
    expect(json.expiresAt).toBeDefined()
  })

  it('falls back to parsing audio_url when file_path is missing (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'Old Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: null,
        audio_url: 'https://mock.supabase.co/storage/v1/object/public/audio/user-1/s1/0987654321.mp3',
      },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://mock.supabase.co/storage/v1/object/sign/audio/user-1/s1/0987654321.mp3?token=def456' },
        error: null,
      }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.filename).toBe('Old Song.mp3')
  })

  it('returns 400 for non-completed song', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Draft', user_id: 'user-1', status: 'draft', file_path: null, audio_url: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when no audio file exists', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'No Audio', user_id: 'user-1', status: 'completed', file_path: null, audio_url: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.message).toBe('No audio file available')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 500 when storage signature fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'My Song',
        user_id: 'user-1',
        status: 'completed',
        file_path: 'user-1/s1/1234567890.mp3',
        audio_url: null,
      },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/songs/[id]/export/route.test.ts
```
Expected: 7 tests passing

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/songs/[id]/export/
git commit -m "feat(api): add song export endpoint with signed download URLs"
```

---

### Task 4: 创建导出弹窗组件

**Files:**
- Create: `apps/web/src/app/songs/[id]/export-dialog.tsx`

- [ ] **Step 1: 创建弹窗组件**

```tsx
'use client'

import * as React from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kiyo/ui'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

interface ExportDialogProps {
  songId: string
  songTitle: string
  disabled?: boolean
}

export function ExportDialog({ songId, songTitle, disabled }: ExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/songs/${songId}/export`)
      const data = await res.json()
      if (res.ok && data.downloadUrl) {
        // Create hidden anchor to trigger download with proper filename
        const link = document.createElement('a')
        link.href = data.downloadUrl
        link.download = data.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setOpen(false)
        toast.success('已开始下载')
      } else {
        toast.error(data.error?.message || '导出失败，请稍后重试')
      }
    } catch {
      toast.error('导出失败，请检查网络连接')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Download className="mr-1 h-4 w-4" />
        导出
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出音频</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">歌曲</span>
            <span className="font-medium">{songTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">格式</span>
            <span className="font-medium">MP3</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? '准备中...' : '确认导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd /home/kk/Github/kiyo/apps/web && npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/[id]/export-dialog.tsx
git commit -m "feat(web): add export dialog component for song download"
```

---

### Task 5: 接入歌曲详情页

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`

- [ ] **Step 1: 导入 ExportDialog 并添加按钮**

在 `page.tsx` 顶部添加 import：

```ts
import { ExportDialog } from './export-dialog'
```

在 header 按钮组中（`status === 'completed' && song.audio_url` 条件块内），在「AI 翻唱」按钮前添加导出按钮：

```tsx
          {song.status === 'completed' && song.audio_url && (
            <>
              <ExportDialog
                songId={song.id}
                songTitle={song.title}
              />
              <Link href={`/songs/cover?original_song_id=${song.id}`}>
                <Button variant="outline" size="sm">
                  <Mic2 className="mr-1 h-4 w-4" />
                  AI 翻唱
                </Button>
              </Link>
            </>
          )}
```

> 注意：原代码中「AI 翻唱」按钮的条件是 `song.status === 'completed' && song.audio_url`，将 ExportDialog 也放在同一条件块内，并改为 Fragment `<>` 包裹两个按钮。

- [ ] **Step 2: 运行类型检查**

```bash
cd /home/kk/Github/kiyo/apps/web && npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/[id]/page.tsx
git commit -m "feat(web): integrate export dialog into song detail page"
```

---

### Task 6: 端到端验证

**Files:**
- 无需修改代码

- [ ] **Step 1: 运行全部 API 测试**

```bash
cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/songs/
```
Expected: All tests passing (existing + new export tests)

- [ ] **Step 2: 运行类型检查**

```bash
cd /home/kk/Github/kiyo/apps/web && npx tsc --noEmit
```
Expected: PASS

- [ ] **Step 3: 运行 lint**

```bash
cd /home/kk/Github/kiyo/apps/web && npx next lint --dir src/app/songs
```
Expected: PASS

- [ ] **Step 4: Commit（如有格式化修复）**

```bash
git diff --stat
git add -A && git commit -m "chore: fix formatting after issue #27 changes" || echo "No changes"
```

---

## Self-Review

### Spec Coverage Check

| Spec 需求 | 对应任务 |
|-----------|---------|
| 新增 `file_path` 字段 | Task 1 |
| 数据回填（audio_url → file_path） | Task 1 |
| AI 生成时写入 file_path | Task 2 |
| 导出 API（签名链接） | Task 3 |
| 导出弹窗组件 | Task 4 |
| 接入歌曲详情页 | Task 5 |
| 旧数据兼容（fallback URL 解析） | Task 3 (parseFilePathFromUrl) |
| 文件名安全处理 | Task 3 (sanitizeFilename) |

### Placeholder Scan

- 无 "TBD" / "TODO" / "implement later"
- 每步都有完整代码
- 每步都有明确的运行命令和期望输出

### Type Consistency

- `file_path` 在迁移、生成 API、导出 API、测试中名称一致
- `downloadUrl` / `filename` / `expiresAt` 在 API 响应和前端弹窗中一致
- `songId` / `songTitle` 在弹窗 props 和 page.tsx 中一致

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-audio-export.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
