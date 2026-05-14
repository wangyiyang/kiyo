# 未登录用户访问个人页面鉴权统一 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一所有个人内容页和账号设置页的鉴权行为：未登录用户访问时跳转登录页并保留 `redirectTo`，登录后自动返回。

**Architecture:** 在需要鉴权的 page.tsx 或 layout.tsx 中使用已有的 server-side `RequireAuth` 组件，传入 `redirectTo` 参数。对于当前为 `'use client'` 的列表页（`/songs`、`/lyrics`、`/albums`），将列表逻辑提取为独立的 client 组件，page.tsx 改为 server component wrapper。

**Tech Stack:** Next.js 14/15 App Router, React, TypeScript, next-intl, Supabase, Tailwind CSS

---

## File Structure

### 新建文件（3 个）
- `apps/web/src/app/[locale]/songs/songs-list.tsx` — 提取的 `/songs` 列表 client 组件
- `apps/web/src/app/[locale]/lyrics/lyrics-list.tsx` — 提取的 `/lyrics` 列表 client 组件
- `apps/web/src/app/[locale]/albums/albums-list.tsx` — 提取的 `/albums` 列表 client 组件

### 修改文件（11 个）
- `apps/web/src/app/[locale]/songs/page.tsx` — 改为 server component + `RequireAuth`
- `apps/web/src/app/[locale]/lyrics/page.tsx` — 改为 server component + `RequireAuth`
- `apps/web/src/app/[locale]/albums/page.tsx` — 改为 server component + `RequireAuth`
- `apps/web/src/app/[locale]/settings/page.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/dashboard/page.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/songs/[id]/page.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/albums/[id]/page.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/lyrics/[id]/page.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/songs/[id]/edit/layout.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/lyrics/[id]/edit/layout.tsx` — 补传 `redirectTo`
- `apps/web/src/app/[locale]/songs/cover/layout.tsx` — 补传 `redirectTo`

---

## 前置依赖

> 计划假设以下文件已存在且功能正常，不需要修改：
> - `apps/web/src/components/auth/require-auth.tsx` — `RequireAuth` server component
> - `apps/web/src/app/[locale]/login/page.tsx` — 已正确处理 `searchParams.redirectTo`

---

### Task 1: 重构 `/songs` 列表页 — 提取 client 组件 + 添加鉴权

**Files:**
- Create: `apps/web/src/app/[locale]/songs/songs-list.tsx`
- Modify: `apps/web/src/app/[locale]/songs/page.tsx`

当前 `songs/page.tsx` 是一个 `'use client'` 组件，包含完整的列表获取、分页、删除逻辑。需要提取列表逻辑到 `songs-list.tsx`，`page.tsx` 改为 server component 包裹 `RequireAuth`。

- [ ] **Step 1: 创建 `songs-list.tsx`（提取当前 page.tsx 的全部逻辑）**

将当前 `songs/page.tsx` 的完整内容复制到 `songs-list.tsx`，做以下调整：
1. 顶部添加 `'use client'` 指令
2. 将 `export default function SongsPage()` 改为 `export default function SongsList()`
3. 移除 `import { Link, useRouter } from '@/i18n/navigation'` 中未使用的 `Link`（如果 SongsList 不需要的话）

保留所有 hooks、状态、类型定义、事件处理不变。组件代码如下（与当前 page.tsx 完全一致，仅函数名和导出名不同）：

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { EmptyState, SongCard, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@kiyo/ui'
import { useRouter } from '@/i18n/navigation'
import { AuthGuardButton } from '@/components/auth/auth-guard-button'
import { Wand2, Mic2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  duration: number | null
  lyrics?: { title: string; id: string } | null
  cover_url: string | null
  cover_file_path: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function SongsList() {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('songs')
  const tCommon = useTranslations('common')

  const [songs, setSongs] = useState<Song[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; song: Song | null }>({ open: false, song: null })
  const [deleting, setDeleting] = useState(false)

  const page = pagination.page

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/songs?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSongs(data.songs ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setSongs([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  const statusLabelMap: Record<string, string> = {
    draft: tCommon('states.loading'),
    generating: tCommon('states.generating'),
    completed: t('detail.source.manual'),
    failed: tCommon('errors.unknown'),
  }

  const handleDelete = async () => {
    if (!deleteDialog.song) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/songs/${deleteDialog.song.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteDialog({ open: false, song: null })
        fetchSongs()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      alert(tCommon('errors.unknown'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
          <AuthGuardButton
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </AuthGuardButton>
          <Link
            href="/songs/cover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Mic2 className="h-4 w-4" />
            {t('list.cover')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">{tCommon('states.loading')}</div>
      ) : songs.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                status={song.status}
                statusLabel={statusLabelMap[song.status] ?? song.status}
                duration={song.duration}
                lyricTitle={song.lyrics?.title ?? null}
                coverUrl={song.cover_url}
                coverFilePath={song.cover_file_path}
                href={`/songs/${song.id}`}
                onDelete={(id) => setDeleteDialog({ open: true, song: songs.find((s) => s.id === id) ?? null })}
                onCover={(id) => router.push(`/songs/cover?original_song_id=${id}`)}
              />
            ))}
          </div>

          <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, song: open ? deleteDialog.song : null })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('detail.deleteConfirmTitle')}</DialogTitle>
                <DialogDescription>
                  {deleteDialog.song && t('detail.deleteConfirmDescription', { title: deleteDialog.song.title })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialog({ open: false, song: null })} disabled={deleting}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? tCommon('states.deleting') : t('detail.delete')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title={tCommon('empty.songs.title')} description={tCommon('empty.songs.description')} />
      )}
    </div>
  )
}
```

> **注意**：songs-list.tsx 中 `Link` 从 `@/i18n/navigation` 导入，保留在 import 中（原代码使用了 `<Link href="/songs/cover">`）。

- [ ] **Step 2: 重写 `songs/page.tsx` 为 server component**

```tsx
import { RequireAuth } from '@/components/auth/require-auth'
import SongsList from './songs-list'

export default async function SongsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/songs">
      <SongsList />
    </RequireAuth>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/"[locale]"/songs/songs-list.tsx apps/web/src/app/"[locale]"/songs/page.tsx
git commit -m "feat(auth): add RequireAuth guard to /songs list page (issue #174)"
```

---

### Task 2: 重构 `/lyrics` 列表页 — 提取 client 组件 + 添加鉴权

**Files:**
- Create: `apps/web/src/app/[locale]/lyrics/lyrics-list.tsx`
- Modify: `apps/web/src/app/[locale]/lyrics/page.tsx`

与 Task 1 模式完全一致。将当前 `lyrics/page.tsx` 的全部内容提取到 `lyrics-list.tsx`，`page.tsx` 改为 server component wrapper。

- [ ] **Step 1: 创建 `lyrics-list.tsx`**

将当前 `lyrics/page.tsx` 完整内容复制到 `lyrics-list.tsx`：
1. 顶部添加 `'use client'` 指令
2. 将 `export default function LyricsPage()` 改为 `export default function LyricsList()`

完整代码与当前 `lyrics/page.tsx` 一致，仅函数名不同。保留所有 import、类型、hooks、状态、事件处理不变。

- [ ] **Step 2: 重写 `lyrics/page.tsx` 为 server component**

```tsx
import { RequireAuth } from '@/components/auth/require-auth'
import LyricsList from './lyrics-list'

export default async function LyricsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/lyrics">
      <LyricsList />
    </RequireAuth>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/"[locale]"/lyrics/lyrics-list.tsx apps/web/src/app/"[locale]"/lyrics/page.tsx
git commit -m "feat(auth): add RequireAuth guard to /lyrics list page (issue #174)"
```

---

### Task 3: 重构 `/albums` 列表页 — 提取 client 组件 + 添加鉴权

**Files:**
- Create: `apps/web/src/app/[locale]/albums/albums-list.tsx`
- Modify: `apps/web/src/app/[locale]/albums/page.tsx`

与 Task 1 模式完全一致。

- [ ] **Step 1: 创建 `albums-list.tsx`**

将当前 `albums/page.tsx` 完整内容复制到 `albums-list.tsx`：
1. 顶部添加 `'use client'` 指令
2. 将 `export default function AlbumsPage()` 改为 `export default function AlbumsList()`

- [ ] **Step 2: 重写 `albums/page.tsx` 为 server component**

```tsx
import { RequireAuth } from '@/components/auth/require-auth'
import AlbumsList from './albums-list'

export default async function AlbumsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/albums">
      <AlbumsList />
    </RequireAuth>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/"[locale]"/albums/albums-list.tsx apps/web/src/app/"[locale]"/albums/page.tsx
git commit -m "feat(auth): add RequireAuth guard to /albums list page (issue #174)"
```

---

### Task 4: 补传 `redirectTo` — 静态页面（settings + dashboard）

**Files:**
- Modify: `apps/web/src/app/[locale]/settings/page.tsx`
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: 修改 `settings/page.tsx`**

找到 `<RequireAuth>`（第 27 行附近），改为：

```tsx
      <RequireAuth redirectTo="/login?redirectTo=/settings">
```

- [ ] **Step 2: 修改 `dashboard/page.tsx`**

找到 `<RequireAuth>`（第 120 行附近），改为：

```tsx
    <RequireAuth redirectTo="/login?redirectTo=/dashboard">
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/"[locale]"/settings/page.tsx apps/web/src/app/"[locale]"/dashboard/page.tsx
git commit -m "fix(auth): add redirectTo to settings and dashboard guards (issue #174)"
```

---

### Task 5: 补传 `redirectTo` — 详情页（songs/[id] + albums/[id] + lyrics/[id]）

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/[id]/page.tsx`
- Modify: `apps/web/src/app/[locale]/albums/[id]/page.tsx`
- Modify: `apps/web/src/app/[locale]/lyrics/[id]/page.tsx`

- [ ] **Step 1: 修改 `songs/[id]/page.tsx`**

当前代码：
```tsx
export default async function SongDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const { locale, id } = params
  return (
    <RequireAuth>
      <SongDetailContent locale={locale} id={id} />
    </RequireAuth>
  )
}
```

改为：
```tsx
export default async function SongDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const { locale, id } = params
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/songs/${id}`}>
      <SongDetailContent locale={locale} id={id} />
    </RequireAuth>
  )
}
```

- [ ] **Step 2: 修改 `albums/[id]/page.tsx`**

当前代码：
```tsx
export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { locale, id } = await params
  return (
    <RequireAuth>
      <AlbumDetailContent locale={locale} id={id} />
    </RequireAuth>
  )
}
```

改为：
```tsx
export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { locale, id } = await params
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/albums/${id}`}>
      <AlbumDetailContent locale={locale} id={id} />
    </RequireAuth>
  )
}
```

- [ ] **Step 3: 修改 `lyrics/[id]/page.tsx`**

当前代码：
```tsx
export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <RequireAuth>
      <LyricDetailContent params={params} />
    </RequireAuth>
  )
}
```

改为：
```tsx
export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/lyrics/${params.id}`}>
      <LyricDetailContent params={params} />
    </RequireAuth>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/"[locale]"/songs/"[id]"/page.tsx apps/web/src/app/"[locale]"/albums/"[id]"/page.tsx apps/web/src/app/"[locale]"/lyrics/"[id]"/page.tsx
git commit -m "fix(auth): add redirectTo to detail page guards (issue #174)"
```

---

### Task 6: 补传 `redirectTo` — 编辑和翻唱布局（3 个 layout）

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/[id]/edit/layout.tsx`
- Modify: `apps/web/src/app/[locale]/lyrics/[id]/edit/layout.tsx`
- Modify: `apps/web/src/app/[locale]/songs/cover/layout.tsx`

- [ ] **Step 1: 修改 `songs/[id]/edit/layout.tsx`**

当前代码：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function SongEditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
```

改为：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function SongEditLayout({
  params,
  children,
}: {
  params: { id: string }
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/songs/${params.id}/edit`}>
      {children}
    </RequireAuth>
  )
}
```

- [ ] **Step 2: 修改 `lyrics/[id]/edit/layout.tsx`**

当前代码：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function LyricEditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
```

改为：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function LyricEditLayout({
  params,
  children,
}: {
  params: { id: string }
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/lyrics/${params.id}/edit`}>
      {children}
    </RequireAuth>
  )
}
```

- [ ] **Step 3: 修改 `songs/cover/layout.tsx`**

当前代码：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function CoverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
```

改为：
```tsx
import { RequireAuth } from '@/components/auth/require-auth'

export default async function CoverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/songs/cover">
      {children}
    </RequireAuth>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/"[locale]"/songs/"[id]"/edit/layout.tsx apps/web/src/app/"[locale]"/lyrics/"[id]"/edit/layout.tsx apps/web/src/app/"[locale]"/songs/cover/layout.tsx
git commit -m "fix(auth): add redirectTo to edit and cover layout guards (issue #174)"
```

---

### Task 7: TypeScript 类型检查与验证

**Files:** N/A（验证步骤）

- [ ] **Step 1: 运行类型检查**

```bash
cd apps/web && pnpm type-check
```

预期结果：无类型错误。

> 如果 `songs-list.tsx`、`lyrics-list.tsx`、`albums-list.tsx` 中出现 import 或类型错误，检查：
> - `'use client'` 指令是否在第一行
> - 所有 import 路径是否正确（从原始 page.tsx 复制时应保持一致）
> - `Link` 组件是否需要从 `@/i18n/navigation` import（songs-list 和 lyrics-list 使用了 `<Link>`）

- [ ] **Step 2: 运行测试**

```bash
cd apps/web && pnpm test
```

预期结果：所有现有测试通过。本次改动不修改测试文件，不应破坏任何现有测试。

- [ ] **Step 3: 提交验证结果（如需要修复）**

如果 Step 1 或 Step 2 发现问题，修复后 commit：

```bash
git add <fixed-files>
git commit -m "fix(auth): resolve type errors after auth guard changes"
```

如果无问题，不需要额外 commit。

---

## 验证清单（改动完成后人工/自动验证）

- [ ] 未登录访问 `/songs` → 跳转 `/login?redirectTo=/songs`
- [ ] 未登录访问 `/lyrics` → 跳转 `/login?redirectTo=/lyrics`
- [ ] 未登录访问 `/albums` → 跳转 `/login?redirectTo=/albums`
- [ ] 未登录访问 `/settings` → 跳转 `/login?redirectTo=/settings`
- [ ] 未登录访问 `/dashboard` → 跳转 `/login?redirectTo=/dashboard`
- [ ] 未登录访问 `/songs/{id}` → 跳转 `/login?redirectTo=/songs/{id}`
- [ ] 未登录访问 `/albums/{id}` → 跳转 `/login?redirectTo=/albums/{id}`
- [ ] 未登录访问 `/lyrics/{id}` → 跳转 `/login?redirectTo=/lyrics/{id}`
- [ ] 未登录访问 `/songs/{id}/edit` → 跳转 `/login?redirectTo=/songs/{id}/edit`
- [ ] 未登录访问 `/songs/cover` → 跳转 `/login?redirectTo=/songs/cover`
- [ ] 登录后 `/songs` 列表正常展示、分页正常
- [ ] 登录后 `/lyrics` 列表正常展示、分页正常
- [ ] 登录后 `/albums` 列表正常展示、分页正常
- [ ] 未登录访问 `/songs/{id}/public` → 正常展示（公开分享页不受影响）
- [ ] 未登录访问 `/albums/{id}/public` → 正常展示（公开分享页不受影响）

---

## Self-Review

### 1. Spec 覆盖
- ✅ `/songs`、`/lyrics`、`/albums` 列表页鉴权 — Task 1-3
- ✅ `/settings` 补 `redirectTo` — Task 4
- ✅ 详情页（`/songs/[id]`、`/albums/[id]`、`/lyrics/[id]`）补 `redirectTo` — Task 5
- ✅ 编辑和翻唱 layout 补 `redirectTo` — Task 6
- ✅ 登录后可回到原始页面 — 所有 `redirectTo` 均正确拼接
- ✅ 公开分享页不受影响 — 不在改动范围内
- ✅ TypeScript 验证 — Task 7

### 2. Placeholder 扫描
- ✅ 无 TBD、TODO、"implement later"
- ✅ 无 "add appropriate error handling" 等模糊描述
- ✅ 所有代码步骤均展示完整代码
- ✅ 无 "Similar to Task N" 引用

### 3. 类型一致性
- ✅ `RequireAuth` props 使用 `redirectTo?: string`，与组件定义一致
- ✅ `params` 签名与现有代码匹配（songs/[id] 为同步，albums/[id] 为 Promise）
- ✅ 列表页提取的组件保持原有类型定义不变
