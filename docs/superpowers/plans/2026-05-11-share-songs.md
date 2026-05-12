# 歌曲/专辑分享功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现歌曲和专辑的公开分享功能，包括公开页面、社交分享按钮、OG Meta 和匿名访问权限控制。

**Architecture:** 数据库新增 `is_public` boolean 字段控制公开状态；新增独立公开页路由（`/songs/:id/public`、`/albums/:id/public`）供未登录用户访问；详情页嵌入 `ShareButton` 客户端组件处理设为公开和复制链接；收紧 RLS 策略使匿名用户仅可读公开作品。

**Tech Stack:** Next.js 14 App Router, React Server Components, Supabase RLS, next-intl, shadcn/ui (DropdownMenu), Vitest

---

## 文件结构

```
新建：
├── supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql
├── apps/web/src/components/share-button.tsx
├── apps/web/src/app/[locale]/songs/[id]/public/page.tsx
├── apps/web/src/app/[locale]/albums/[id]/public/page.tsx

修改：
├── apps/web/src/app/api/songs/[id]/route.ts          (PATCH 允许 is_public)
├── apps/web/src/app/api/albums/[id]/route.ts         (PATCH 允许 is_public)
├── apps/web/src/app/api/songs/[id]/route.test.ts     (is_public PATCH 测试)
├── apps/web/src/app/api/albums/[id]/route.test.ts    (is_public PATCH 测试)
├── apps/web/src/app/[locale]/songs/[id]/page.tsx     (+ ShareButton)
├── apps/web/src/app/[locale]/albums/[id]/page.tsx    (+ ShareButton)
├── apps/web/src/app/[locale]/explore/page.tsx        (.eq('is_public', true))
├── apps/web/messages/en.json                         (+ share namespace)
└── apps/web/messages/zh.json                         (+ share namespace)
```

---

### Task 1: 数据库迁移 — 添加 is_public 字段并收紧 RLS

**Files:**
- Create: `supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql`

- [ ] **Step 1: 编写迁移文件**

```sql
-- 给 songs 表添加公开分享开关
alter table songs add column is_public boolean not null default false;

-- 给 albums 表添加公开分享开关
alter table albums add column is_public boolean not null default false;

-- 收紧匿名读取策略：仅允许读取公开作品
drop policy if exists "anon_read_all_songs" on songs;
create policy "anon_read_public_songs"
  on songs for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_albums" on albums;
create policy "anon_read_public_albums"
  on albums for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_album_songs" on album_songs;
create policy "anon_read_public_album_songs"
  on album_songs for select
  to anon
  using (album_id in (select id from albums where is_public = true));
```

- [ ] **Step 2: Commit**

```bash
git add supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql
git commit -m "feat(db): add is_public to songs/albums and tighten anon RLS policies (#74)"
```

---

### Task 2: 修改 Songs PATCH API 允许更新 is_public

**Files:**
- Modify: `apps/web/src/app/api/songs/[id]/route.ts`

- [ ] **Step 1: 修改 allowed 字段列表，加入 is_public**

在 `apps/web/src/app/api/songs/[id]/route.ts` 中，将：

```ts
const allowed = ['title', 'lyric_id', 'genre', 'mood', 'ai_prompt', 'cover_url']
```

替换为：

```ts
const allowed = ['title', 'lyric_id', 'genre', 'mood', 'ai_prompt', 'cover_url', 'is_public']
```

并在循环内 `} else if (body[key] === null) {` 之前添加对 `is_public` 的处理：

```ts
      } else if (key === 'is_public') {
        if (typeof body[key] !== 'boolean') {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'is_public must be a boolean' } },
            { status: 400 }
          )
        }
        updates[key] = body[key]
      } else if (body[key] === null) {
```

- [ ] **Step 2: 为 PATCH 添加 is_public 测试**

在 `apps/web/src/app/api/songs/[id]/route.test.ts` 的 `describe('PATCH /api/songs/:id')` 内添加：

```ts
  it('updates is_public field (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song', user_id: 'user-1', status: 'completed', is_public: false },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.is_public).toBe(true)
  })

  it('rejects invalid is_public value (400)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song', user_id: 'user-1', status: 'completed' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
```

- [ ] **Step 3: 运行测试确认通过**

```bash
pnpm --filter web test apps/web/src/app/api/songs/\[id\]/route.test.ts
```

Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/songs/\[id\]/route.ts apps/web/src/app/api/songs/\[id\]/route.test.ts
git commit -m "feat(api): allow PATCH is_public on songs (#74)"
```

---

### Task 3: 修改 Albums PATCH API 允许更新 is_public

**Files:**
- Modify: `apps/web/src/app/api/albums/[id]/route.ts`

- [ ] **Step 1: 修改 body 解构和更新逻辑**

在 `apps/web/src/app/api/albums/[id]/route.ts` 中，将：

```ts
  const { title, song_ids } = body
```

替换为：

```ts
  const { title, song_ids, is_public } = body
```

在 `if (title !== undefined) { ... }` 代码块之后、`if (song_ids && Array.isArray(song_ids)) { ... }` 之前，添加：

```ts
  if (is_public !== undefined) {
    if (typeof is_public !== 'boolean') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'is_public must be a boolean' } },
        { status: 400 }
      )
    }

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ is_public })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }

    Object.assign(album, updatedAlbum)
  }
```

- [ ] **Step 2: 为 PATCH 添加 is_public 测试**

在 `apps/web/src/app/api/albums/[id]/route.test.ts` 的 `describe('PATCH /api/albums/:id')` 内添加：

```ts
  it('updates is_public field (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album', user_id: 'user-1', is_public: false },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'a1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.album.is_public).toBe(true)
  })

  it('rejects invalid is_public value (400)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ is_public: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'a1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
```

- [ ] **Step 3: 运行测试确认通过**

```bash
pnpm --filter web test apps/web/src/app/api/albums/\[id\]/route.test.ts
```

Expected: 所有测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/route.ts apps/web/src/app/api/albums/\[id\]/route.test.ts
git commit -m "feat(api): allow PATCH is_public on albums (#74)"
```

---

### Task 4: 创建 ShareButton 客户端组件

**Files:**
- Create: `apps/web/src/components/share-button.tsx`

- [ ] **Step 1: 编写 ShareButton 组件**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kiyo/ui'
import { Share2, Link2, Twitter } from 'lucide-react'
import { toast } from 'sonner'

interface ShareButtonProps {
  entityType: 'song' | 'album'
  entityId: string
  title: string
  isPublic: boolean
  locale: string
}

export function ShareButton({ entityType, entityId, title, isPublic, locale }: ShareButtonProps) {
  const t = useTranslations('share')
  const [copied, setCopied] = useState(false)
  const [makingPublic, setMakingPublic] = useState(false)

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${locale}/${entityType}s/${entityId}/public`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success(t('copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const handleTwitter = () => {
    const text = encodeURIComponent(`${title} — ${t('twitterText')}`)
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(publicUrl)}`,
      '_blank'
    )
  }

  const handleMakePublic = async () => {
    setMakingPublic(true)
    try {
      const res = await fetch(`/api/${entityType}s/${entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed')
      }
      await navigator.clipboard.writeText(publicUrl)
      toast.success(t('madePublic'))
      window.location.reload()
    } catch {
      toast.error(t('makePublicFailed'))
    } finally {
      setMakingPublic(false)
    }
  }

  if (!isPublic) {
    return (
      <Button variant="outline" size="sm" onClick={handleMakePublic} disabled={makingPublic}>
        <Share2 className="mr-1 h-4 w-4" />
        {makingPublic ? t('makingPublic') : t('button')}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-1 h-4 w-4" />
          {t('button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy}>
          <Link2 className="mr-2 h-4 w-4" />
          {copied ? t('copied') : t('copyLink')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTwitter}>
          <Twitter className="mr-2 h-4 w-4" />
          {t('shareTwitter')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/share-button.tsx
git commit -m "feat(ui): add ShareButton component (#74)"
```

---

### Task 5: 添加 i18n 文案

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: 在 en.json 中新增 share namespace**

在 `apps/web/messages/en.json` 的任意顶层 key 之间（例如放在 `"common"` 之前），插入：

```json
  "share": {
    "button": "Share",
    "copyLink": "Copy Link",
    "copied": "Copied!",
    "copyFailed": "Failed to copy link",
    "shareTwitter": "Share on X",
    "twitterText": "Created with Kiyo",
    "makingPublic": "Making public...",
    "madePublic": "Made public and link copied!",
    "makePublicFailed": "Failed to make public",
    "loginToPlay": "Log in to Play",
    "playOnKiyo": "View on Kiyo"
  },
```

- [ ] **Step 2: 在 zh.json 中新增 share namespace**

在 `apps/web/messages/zh.json` 的对应位置插入：

```json
  "share": {
    "button": "分享",
    "copyLink": "复制链接",
    "copied": "已复制！",
    "copyFailed": "复制链接失败",
    "shareTwitter": "分享到 X",
    "twitterText": "使用 Kiyo 创作",
    "makingPublic": "正在设为公开...",
    "madePublic": "已设为公开并复制链接！",
    "makePublicFailed": "设为公开失败",
    "loginToPlay": "登录以播放",
    "playOnKiyo": "在 Kiyo 上查看"
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/zh.json
git commit -m "feat(i18n): add share namespace for en and zh (#74)"
```

---

### Task 6: 在歌曲详情页嵌入 ShareButton

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/[id]/page.tsx`

- [ ] **Step 1: 导入 ShareButton 并获取 locale**

在 `apps/web/src/app/[locale]/songs/[id]/page.tsx` 顶部添加导入：

```tsx
import { ShareButton } from '@/components/share-button'
```

修改组件签名以接收 `params` 中的 `locale`（如果尚未解构）：

现有签名：
```tsx
export default async function SongDetailPage({
  params,
}: {
  params: { id: string }
})
```

需要修改为接收 `locale` 以传给 ShareButton。由于现有代码中 `params` 仅包含 `id`，而 Next.js 的 `[locale]` 动态段也会出现在 params 中，所以改为：

```tsx
export default async function SongDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const { locale, id } = params
```

并将后续所有 `params.id` 替换为 `id`。

- [ ] **Step 2: 在操作按钮组中插入 ShareButton**

在 `apps/web/src/app/[locale]/songs/[id]/page.tsx` 的按钮组区域（`song.status === 'completed' ...` 条件块之后），找到：

```tsx
          <Link href={`/songs/${song.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-4 w-4" />
              {t('edit')}
            </Button>
          </Link>
          <DeleteButton songId={song.id} songTitle={song.title} />
```

在这两行之间插入：

```tsx
          <ShareButton
            entityType="song"
            entityId={song.id}
            title={song.title}
            isPublic={song.is_public ?? false}
            locale={locale}
          />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/songs/\[id\]/page.tsx
git commit -m "feat(songs): add ShareButton to song detail page (#74)"
```

---

### Task 7: 在专辑详情页嵌入 ShareButton

**Files:**
- Modify: `apps/web/src/app/[locale]/albums/[id]/page.tsx`

- [ ] **Step 1: 导入 ShareButton 并获取 locale**

在 `apps/web/src/app/[locale]/albums/[id]/page.tsx` 顶部添加导入：

```tsx
import { ShareButton } from '@/components/share-button'
```

修改组件签名和参数解构。现有：

```tsx
interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
```

修改为：

```tsx
interface AlbumDetailPageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { locale, id } = await params
```

- [ ] **Step 2: 在操作区插入 ShareButton**

在 `apps/web/src/app/[locale]/albums/[id]/page.tsx` 中找到：

```tsx
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('detail.songCount', { count: songs.length })}</span>
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
```

修改为：

```tsx
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('detail.songCount', { count: songs.length })}</span>
          <ShareButton
            entityType="album"
            entityId={id}
            title={album.title}
            isPublic={album.is_public ?? false}
            locale={locale}
          />
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/albums/\[id\]/page.tsx
git commit -m "feat(albums): add ShareButton to album detail page (#74)"
```

---

### Task 8: 创建歌曲公开分享页

**Files:**
- Create: `apps/web/src/app/[locale]/songs/[id]/public/page.tsx`

- [ ] **Step 1: 编写歌曲公开页**

```tsx
import { Metadata } from 'next'
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button } from '@kiyo/ui'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Play, ArrowLeft } from 'lucide-react'

interface SongPublicPageProps {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: SongPublicPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: song } = await supabase
    .from('songs')
    .select('title, genre, mood, cover_url, cover_file_path')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!song) {
    return { title: 'Not Found' }
  }

  const title = `${song.title} - Kiyo`
  const description = [song.genre, song.mood, 'Created with Kiyo'].filter(Boolean).join(' · ')
  const image = song.cover_url || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: 'music.song',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function SongPublicPage({ params }: SongPublicPageProps) {
  const { locale, id } = await params
  const supabase = await createServerClient()
  const t = await getTranslations('share')
  const tCommon = await getTranslations('common')

  const { data: { user } } = await supabase.auth.getUser()

  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!song) {
    notFound()
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      {/* Cover */}
      <div className="mb-6">
        <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {song.cover_url ? (
            <img src={song.cover_url} alt={song.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/10" />
          )}
        </div>
      </div>

      {/* Title & Meta */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{song.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {song.genre && <span>{song.genre}</span>}
          {song.mood && <span>{song.mood}</span>}
          {song.duration && (
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {formatDuration(song.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Audio */}
      {song.status === 'completed' && (song.audio_url || song.file_path) && (
        <div className="mb-6">
          {user ? (
            <AudioPlayer
              src={song.audio_url || ''}
              filePath={song.file_path}
              title={song.title}
              duration={song.duration}
              coverUrl={song.cover_url}
              coverFilePath={song.cover_file_path}
              songId={song.id}
              className="w-full"
            />
          ) : (
            <div className="relative rounded-lg border bg-muted/30 p-8">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{t('loginToPlay')}</p>
                <Link href={`/login?redirect=/songs/${id}/public`}>
                  <Button size="sm">{t('loginToPlay')}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lyrics */}
      {song.lyrics && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{tCommon('songs.detail.lyrics')}</h2>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-8 flex justify-center">
        <Link href="/explore">
          <Button variant="outline">{t('playOnKiyo')}</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/songs/\[id\]/public/page.tsx
git commit -m "feat(share): add public song share page (#74)"
```

---

### Task 9: 创建专辑公开分享页

**Files:**
- Create: `apps/web/src/app/[locale]/albums/[id]/public/page.tsx`

- [ ] **Step 1: 编写专辑公开页**

```tsx
import { Metadata } from 'next'
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button } from '@kiyo/ui'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Play } from 'lucide-react'

interface AlbumPublicPageProps {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: AlbumPublicPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: album } = await supabase
    .from('albums')
    .select('title, description, cover_url, cover_file_path')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!album) {
    return { title: 'Not Found' }
  }

  const title = `${album.title} - Kiyo`
  const description = [album.description, 'Created with Kiyo'].filter(Boolean).join(' · ')
  const image = album.cover_url || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: 'music.album',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function AlbumPublicPage({ params }: AlbumPublicPageProps) {
  const { locale, id } = await params
  const supabase = await createServerClient()
  const t = await getTranslations('share')
  const tCommon = await getTranslations('common')

  const { data: { user } } = await supabase.auth.getUser()

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(id, title, audio_url, file_path, cover_url, cover_file_path, duration)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs).filter(Boolean)

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      {/* Cover */}
      <div className="mb-6">
        <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {album.cover_url ? (
            <img src={album.cover_url} alt={album.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/10" />
          )}
        </div>
      </div>

      {/* Title & Description */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      {/* Album Player */}
      {songs.length > 0 && (
        <div className="mb-6">
          {user ? (
            <AudioPlayer
              src={songs[0]?.audio_url || ''}
              filePath={songs[0]?.file_path}
              title={songs[0]?.title}
              album={album.title}
              coverUrl={album.cover_url}
              coverFilePath={album.cover_file_path}
              songId={songs[0]?.id}
              playlist={songs.map((s: any) => ({
                id: s.id,
                title: s.title,
                audio_url: s.audio_url || '',
                file_path: s.file_path,
                cover_url: s.cover_url,
                duration: s.duration,
                album: album.title,
              }))}
              className="w-full"
            />
          ) : (
            <div className="relative rounded-lg border bg-muted/30 p-8">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{t('loginToPlay')}</p>
                <Link href={`/login?redirect=/albums/${id}/public`}>
                  <Button size="sm">{t('loginToPlay')}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Song List */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">{tCommon('albums.detail.songList')}</h2>
        <div className="divide-y rounded-lg border">
          {songs.map((song: any, index: number) => (
            <div key={song.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
                <span className="font-medium">{song.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">{formatDuration(song.duration)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 flex justify-center">
        <Link href="/explore">
          <Button variant="outline">{t('playOnKiyo')}</Button>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/albums/\[id\]/public/page.tsx
git commit -m "feat(share): add public album share page (#74)"
```

---

### Task 10: Explore 页面只展示公开作品

**Files:**
- Modify: `apps/web/src/app/[locale]/explore/page.tsx`

- [ ] **Step 1: 在 songs 查询添加 is_public 过滤**

在 `apps/web/src/app/[locale]/explore/page.tsx` 中，找到：

```tsx
  let query = supabase
    .from("songs")
    .select("id, title, genre, mood, cover_url, cover_file_path, audio_url, file_path, duration")
```

替换为：

```tsx
  let query = supabase
    .from("songs")
    .select("id, title, genre, mood, cover_url, cover_file_path, audio_url, file_path, duration")
    .eq("is_public", true)
```

- [ ] **Step 2: 在 allSongs 查询也添加过滤（用于 genre/mood 筛选列表）**

找到：

```tsx
  const { data: allSongs } = await supabase
    .from("songs")
    .select("genre, mood")
```

替换为：

```tsx
  const { data: allSongs } = await supabase
    .from("songs")
    .select("genre, mood")
    .eq("is_public", true)
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/explore/page.tsx
git commit -m "feat(explore): only show public songs (#74)"
```

---

### Task 11: 类型检查与验证

- [ ] **Step 1: 运行 TypeScript 类型检查**

```bash
pnpm type-check
```

Expected: 无类型错误

- [ ] **Step 2: 运行所有 web 测试**

```bash
pnpm --filter web test
```

Expected: 所有测试通过

- [ ] **Step 3: 最终 Commit（如有需要）**

如果测试过程中有修复，commit 它们。

---

## 自检

**Spec coverage check:**

| Spec 要求 | 对应 Task |
|---|---|
| 数据库 `is_public` 字段 | Task 1 |
| RLS 收紧为仅公开可读 | Task 1 |
| Songs PATCH 允许 `is_public` | Task 2 |
| Albums PATCH 允许 `is_public` | Task 3 |
| ShareButton 组件 | Task 4 |
| i18n 文案 | Task 5 |
| 歌曲详情页嵌入 ShareButton | Task 6 |
| 专辑详情页嵌入 ShareButton | Task 7 |
| 歌曲公开页 + OG meta | Task 8 |
| 专辑公开页 + OG meta | Task 9 |
| Explore 仅展示公开作品 | Task 10 |
| 未登录播放遮罩 + 登录 CTA | Task 8, 9 |
| API 测试覆盖 | Task 2, 3 |

**Placeholder scan:** 无 TBD、TODO、"implement later" 等占位符。所有步骤均包含具体代码和命令。

**Type consistency:** `is_public` 在数据库迁移、API 路由、组件 props、测试数据中使用一致，均为 `boolean`。
