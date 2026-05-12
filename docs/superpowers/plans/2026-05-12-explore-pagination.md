# 探索页无限滚动 + 服务端批量签名实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将探索页改为无限滚动分页，新增公开分页 API 并在服务端批量签名封面 URL，消除首屏签名风暴。

**Architecture:** Server Component 保留头部和筛选器，Client Component `ExploreSongGrid` 通过 IntersectionObserver 驱动无限滚动，调用 `GET /api/explore/songs` 获取分页数据。API 在服务端对 `cover_file_path` 批量签名后直接返回 `cover_url`，客户端无需再请求 `/api/storage/sign`。

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Supabase, Vitest

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/app/api/explore/songs/route.ts` | 创建 | 公开分页 API：无需认证，分页查询 `is_public=true` 歌曲，内存排序（有封面优先），批量签名 |
| `apps/web/src/app/api/explore/songs/route.test.ts` | 创建 | API 单元测试：分页、筛选、排序、批量签名、匿名访问 |
| `apps/web/src/components/explore-song-grid.tsx` | 创建 | Client Component：无限滚动状态管理、IntersectionObserver、加载/结束状态 |
| `apps/web/src/components/sections/showcase-card.tsx` | 修改 | 签名 `useEffect`：仅当 `cover_url` 为空时才请求签名（向后兼容） |
| `apps/web/src/app/[locale]/explore/page.tsx` | 修改 | 移除歌曲查询和全量渲染，替换为 `ExploreSongGrid` |

---

## Task 1: 公开分页 API 路由

### Step 1: 创建目录并写测试

**File:** Create `apps/web/src/app/api/explore/songs/route.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
    createServiceRoleClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

async function setupMockClient(options: { songs?: any[] }) {
  const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
  const mockClient = createMockSupabaseClient({ userId: undefined })
  if (options.songs) mockClient.dataStore.songs = options.songs

  // Bucket-aware storage mock for service role
  mockClient.storage.from = vi.fn().mockImplementation((bucket: string) => ({
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: `https://mock-cdn.supabase.co/storage/v1/object/sign/${bucket}/signed-file?token=mock-token` },
      error: null,
    }),
  }))

  vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
  vi.mocked(createServiceRoleClient).mockReturnValue(mockClient as any)
  return mockClient
}

describe('GET /api/explore/songs', () => {
  it('returns public songs without authentication (200)', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-02T00:00:00Z', cover_url: 'https://example.com/cover1.png', cover_file_path: null, audio_url: 'https://example.com/audio1.mp3', file_path: 'user-1/s1/audio.mp3', duration: 180 },
        { id: 's2', title: 'Song 2', user_id: 'user-2', status: 'completed', is_public: true, created_at: '2024-01-01T00:00:00Z', cover_url: null, cover_file_path: 'covers/s2.png', audio_url: null, file_path: 'user-2/s2/audio.mp3', duration: 200 },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.pagination.page).toBe(1)
    expect(json.pagination.hasMore).toBe(false)
  })

  it('respects page and limit params', async () => {
    await setupMockClient({
      songs: Array.from({ length: 5 }, (_, i) => ({
        id: `s${i + 1}`,
        title: `Song ${i + 1}`,
        user_id: 'user-1',
        status: 'completed',
        is_public: true,
        created_at: `2024-01-0${i + 1}T00:00:00Z`,
        cover_url: `https://example.com/cover${i + 1}.png`,
        cover_file_path: null,
        audio_url: null,
        file_path: null,
        duration: 180,
      })),
    })

    const request = new Request('http://localhost/api/explore/songs?page=2&limit=2')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 3')
    expect(json.pagination.page).toBe(2)
    expect(json.pagination.hasMore).toBe(true)
  })

  it('filters by genre', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Pop Song', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-01T00:00:00Z', genre: 'Pop', mood: 'Happy', cover_url: null, cover_file_path: null, audio_url: null, file_path: null, duration: 180 },
        { id: 's2', title: 'Rock Song', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-01T00:00:00Z', genre: 'Rock', mood: 'Energetic', cover_url: null, cover_file_path: null, audio_url: null, file_path: null, duration: 180 },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs?genre=Pop')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(1)
    expect(json.songs[0].title).toBe('Pop Song')
  })

  it('sorts songs with cover first', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'No Cover', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-02T00:00:00Z', cover_url: null, cover_file_path: null, audio_url: null, file_path: null, duration: 180 },
        { id: 's2', title: 'Has Cover', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-01T00:00:00Z', cover_url: 'https://example.com/cover.png', cover_file_path: null, audio_url: null, file_path: null, duration: 180 },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs[0].title).toBe('Has Cover')
    expect(json.songs[1].title).toBe('No Cover')
  })

  it('batch signs cover_file_path and sets cover_url', async () => {
    await setupMockClient({
      songs: [
        { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'completed', is_public: true, created_at: '2024-01-01T00:00:00Z', cover_url: null, cover_file_path: 'covers/s1.png', audio_url: null, file_path: null, duration: 180 },
      ],
    })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs[0].cover_url).toContain('sign/covers')
  })

  it('returns empty array when no public songs', async () => {
    await setupMockClient({ songs: [] })

    const request = new Request('http://localhost/api/explore/songs')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(0)
    expect(json.pagination.hasMore).toBe(false)
  })

  it('caps limit at MAX_LIMIT', async () => {
    await setupMockClient({
      songs: Array.from({ length: 5 }, (_, i) => ({
        id: `s${i + 1}`,
        title: `Song ${i + 1}`,
        user_id: 'user-1',
        status: 'completed',
        is_public: true,
        created_at: `2024-01-0${i + 1}T00:00:00Z`,
        cover_url: null,
        cover_file_path: null,
        audio_url: null,
        file_path: null,
        duration: 180,
      })),
    })

    const request = new Request('http://localhost/api/explore/songs?page=1&limit=200')
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.pagination.limit).toBe(50)
  })
})
```

### Step 2: 运行测试确认失败

```bash
pnpm --filter web test -- apps/web/src/app/api/explore/songs/route.test.ts
```

**Expected:** FAIL — `Cannot find module './route'` (路由文件尚未创建)

### Step 3: 实现 API 路由

**File:** Create `apps/web/src/app/api/explore/songs/route.ts`

```typescript
import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 18
const MAX_LIMIT = 50

function parsePaginationParams(request: Request): { page: number; limit: number } {
  const url = new URL(request.url)
  const rawPage = url.searchParams.get('page')
  const rawLimit = url.searchParams.get('limit')

  let page = parseInt(rawPage ?? '', 10)
  let limit = parseInt(rawLimit ?? '', 10)

  if (!Number.isFinite(page) || page < 1) page = DEFAULT_PAGE
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT
  if (limit > MAX_LIMIT) limit = MAX_LIMIT

  return { page, limit }
}

interface SongRow {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  cover_file_path: string | null
  audio_url: string | null
  file_path: string | null
  duration: number | null
  created_at: string
}

export async function GET(request: Request) {
  const { page, limit } = parsePaginationParams(request)
  const url = new URL(request.url)
  const genre = url.searchParams.get('genre') || undefined
  const mood = url.searchParams.get('mood') || undefined

  const supabase = await createServerClient()

  // 1. Query all public songs (no range — we sort in memory)
  let query = supabase
    .from('songs')
    .select('id, title, genre, mood, cover_url, cover_file_path, audio_url, file_path, duration, created_at')
    .eq('is_public', true)

  if (genre) {
    query = query.eq('genre', genre)
  }
  if (mood) {
    query = query.eq('mood', mood)
  }

  const { data: allSongs, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  // 2. Memory sort: songs with cover first, then by created_at desc
  const sortedSongs = (allSongs ?? []).sort((a: any, b: any) => {
    const aHasCover = (a.cover_url || a.cover_file_path) ? 1 : 0
    const bHasCover = (b.cover_url || b.cover_file_path) ? 1 : 0
    if (bHasCover !== aHasCover) return bHasCover - aHasCover
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // 3. Manual pagination slice
  const from = (page - 1) * limit
  const to = page * limit
  const pageSongs: SongRow[] = sortedSongs.slice(from, to)

  // 4. Batch sign cover_file_path → cover_url
  const serviceClient = createServiceRoleClient()
  const songsWithSignedCovers = await Promise.all(
    pageSongs.map(async (song) => {
      if (song.cover_file_path && !song.cover_url) {
        const { data: signedData } = await serviceClient
          .storage
          .from('covers')
          .createSignedUrl(song.cover_file_path, 3600)
        return {
          ...song,
          cover_url: signedData?.signedUrl ?? null,
        }
      }
      return song
    })
  )

  // 5. Count total for hasMore
  let countQuery = supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('is_public', true)

  if (genre) countQuery = countQuery.eq('genre', genre)
  if (mood) countQuery = countQuery.eq('mood', mood)

  const { count: total, error: countError } = await countQuery

  if (countError) {
    // Conservative fallback
    return NextResponse.json({
      songs: songsWithSignedCovers,
      pagination: {
        page,
        limit,
        total: 0,
        hasMore: pageSongs.length === limit,
      },
    })
  }

  const totalCount = total ?? 0

  return NextResponse.json({
    songs: songsWithSignedCovers,
    pagination: {
      page,
      limit,
      total: totalCount,
      hasMore: from + pageSongs.length < totalCount,
    },
  })
}
```

### Step 4: 运行测试确认通过

```bash
pnpm --filter web test -- apps/web/src/app/api/explore/songs/route.test.ts
```

**Expected:** All 7 tests PASS

### Step 5: Commit

```bash
git add apps/web/src/app/api/explore/songs/
git commit -m "feat(api): add public explore songs endpoint with pagination and batch signing (#139)"
```

---

## Task 2: ShowcaseCard 签名逻辑微调

### Step 1: 修改 `ShowcaseCard` 的 `useEffect`

**File:** Modify `apps/web/src/components/sections/showcase-card.tsx`

找到这段代码：

```typescript
useEffect(() => {
  if (track.cover_file_path) {
    getSignedCoverUrl(track.cover_file_path).then((url) => {
      setCoverUrl(url || track.cover_url)
    })
  } else {
    setCoverUrl(track.cover_url)
  }
}, [track.cover_file_path, track.cover_url])
```

替换为：

```typescript
useEffect(() => {
  // API already pre-signed the cover_url — use it directly
  if (track.cover_url) {
    setCoverUrl(track.cover_url)
    return
  }
  // Fallback: client-side signing for legacy/un-signed tracks
  if (track.cover_file_path) {
    getSignedCoverUrl(track.cover_file_path).then((url) => {
      setCoverUrl(url || null)
    })
  }
}, [track.cover_url, track.cover_file_path])
```

### Step 2: Commit

```bash
git add apps/web/src/components/sections/showcase-card.tsx
git commit -m "feat(card): skip client-side signing when cover_url is pre-signed (#139)"
```

---

## Task 3: ExploreSongGrid 无限滚动组件

### Step 1: 创建组件

**File:** Create `apps/web/src/components/explore-song-grid.tsx`

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@kiyo/ui'
import { ShowcaseCard } from '@/components/sections/showcase-card'

interface Track {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  cover_file_path: string | null
  audio_url: string | null
  file_path: string | null
  duration: number | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

interface ApiResponse {
  songs: Track[]
  pagination: Pagination
}

interface ExploreSongGridProps {
  genre?: string
  mood?: string
}

const trackGradients = [
  'from-indigo-500 to-cyan-400',
  'from-amber-400 to-pink-400',
  'from-rose-500 to-violet-500',
  'from-sky-500 to-emerald-400',
  'from-fuchsia-500 to-orange-400',
  'from-purple-400 to-pink-300',
]

export function ExploreSongGrid({ genre, mood }: ExploreSongGridProps) {
  const t = useTranslations('explore')
  const [songs, setSongs] = useState<Track[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '18')
      if (genre) params.set('genre', genre)
      if (mood) params.set('mood', mood)

      const res = await fetch(`/api/explore/songs?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data: ApiResponse = await res.json()

      setSongs((prev) => [...prev, ...data.songs])
      setHasMore(data.pagination.hasMore)
      setPage((prev) => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load songs')
    } finally {
      setIsLoading(false)
    }
  }, [page, genre, mood, isLoading, hasMore])

  // Reset when filter params change
  useEffect(() => {
    setSongs([])
    setPage(1)
    setHasMore(true)
    setError(null)
  }, [genre, mood])

  // Trigger first load after reset (when page === 1 and songs is empty)
  useEffect(() => {
    if (page === 1 && songs.length === 0 && hasMore && !isLoading) {
      loadMore()
    }
  }, [page, songs.length, hasMore, isLoading, loadMore])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  if (error && songs.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">{error}</p>
        <button
          onClick={() => {
            setError(null)
            loadMore()
          }}
          className="mt-4 inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('retry')}
        </button>
      </div>
    )
  }

  return (
    <div>
      {songs.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((track, index) => (
            <ShowcaseCard
              key={track.id}
              track={track}
              index={index}
              playlist={songs}
              gradient={trackGradients[index % trackGradients.length]}
            />
          ))}
        </div>
      )}

      {!isLoading && !hasMore && songs.length > 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {t('allLoaded')}
        </p>
      )}

      {!isLoading && !hasMore && songs.length === 0 && (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
        />
      )}

      {isLoading && (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Error with existing songs */}
      {error && songs.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              setError(null)
              loadMore()
            }}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-4" />
    </div>
  )
}
```

### Step 2: 添加 i18n 文案

**File:** Modify `apps/web/messages/en.json` 和 `apps/web/messages/zh.json`

在 `explore` 命名空间下添加：

```json
"retry": "Retry",
"allLoaded": "All songs loaded"
```

对应的 zh.json：

```json
"retry": "重试",
"allLoaded": "已显示全部歌曲"
```

### Step 3: Commit

```bash
git add apps/web/src/components/explore-song-grid.tsx apps/web/messages/
git commit -m "feat(ui): add ExploreSongGrid with infinite scroll (#139)"
```

---

## Task 4: 改造 explore/page.tsx

### Step 1: 修改 Server Component

**File:** Modify `apps/web/src/app/[locale]/explore/page.tsx`

将完整文件替换为：

```typescript
import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { createServerClient } from "@kiyo/supabase/server"
import { EmptyState, cn } from "@kiyo/ui"
import { Link } from "@/i18n/navigation"
import { ExploreSongGrid } from "@/components/explore-song-grid"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; mood?: string }>
}) {
  const t = await getTranslations("explore")
  const { genre, mood } = await searchParams

  const supabase = await createServerClient()

  // Query genre and mood options for filters
  const { data: allSongs } = await supabase
    .from("songs")
    .select("genre, mood")
    .eq("is_public", true)

  const genres = Array.from(
    new Set(allSongs?.map((s) => s.genre).filter(Boolean) as string[])
  ).sort()

  const moods = Array.from(
    new Set(allSongs?.map((s) => s.mood).filter(Boolean) as string[])
  ).sort()

  const buildUrl = (g?: string, m?: string) => {
    const sp = new URLSearchParams()
    if (g) sp.set("genre", g)
    if (m) sp.set("mood", m)
    const qs = sp.toString()
    return `/explore${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background pt-24 pb-16">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {t("title")}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("description")}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Filters */}
        <section className="container mx-auto px-4 py-8">
          {/* Genre filter */}
          <ScrollReveal delay={0.1}>
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t("filters.genre")}</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildUrl(undefined, mood)}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    !genre
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {t("filters.all")}
                </Link>
                {genres.map((g) => (
                  <Link
                    key={g}
                    href={buildUrl(g, mood)}
                    className={cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      genre === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {g}
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Mood filter */}
          <ScrollReveal delay={0.2}>
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t("filters.mood")}</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildUrl(genre, undefined)}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    !mood
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {t("filters.all")}
                </Link>
                {moods.map((m) => (
                  <Link
                    key={m}
                    href={buildUrl(genre, m)}
                    className={cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      mood === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {m}
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Songs Grid — delegated to client component */}
          <ExploreSongGrid genre={genre} mood={mood} />
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
```

### Step 2: 运行 TypeScript 检查

```bash
pnpm --filter web type-check
```

**Expected:** No errors

### Step 3: Commit

```bash
git add apps/web/src/app/\[locale\]/explore/page.tsx
git commit -m "feat(explore): integrate infinite scroll song grid (#139)"
```

---

## Task 5: 全量测试验证

### Step 1: 运行 API 测试

```bash
pnpm --filter web test -- apps/web/src/app/api/explore/songs/route.test.ts
```

**Expected:** All 7 tests PASS

### Step 2: 运行 web 全量测试

```bash
pnpm --filter web test
```

**Expected:** All existing tests still PASS (ShowcaseCard 向后兼容)

### Step 3: TypeScript 全量检查

```bash
pnpm type-check
```

**Expected:** No errors across workspace

### Step 4: Lint

```bash
pnpm lint
```

**Expected:** No lint errors

### Step 5: Commit（如有格式修复）

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: fix lint and type issues"
```

---

## Task 6: 手动验收

### Step 1: 启动开发服务器

```bash
pnpm --filter web dev
```

### Step 2: 浏览器验证

1. 访问 `http://localhost:3000/explore`
2. 打开 DevTools → Network 面板
3. 确认首屏只加载 `/api/explore/songs?page=1` **一个**请求
4. 确认没有 `/api/storage/sign` 请求出现在首屏
5. 向下滚动，观察自动触发 `page=2`、`page=3`... 请求
6. 确认底部出现 "已显示全部歌曲" / "All songs loaded"
7. 点击 genre/mood 筛选器，确认列表重置并重新加载
8. 切换到 390px 移动端视口，重复验证

### Step 3: Commit

```bash
git add -A
git diff --cached --quiet || git commit -m "chore: finalize explore pagination (#139)"
```

---

## 计划自检

### Spec 覆盖检查

| Spec 要求 | 对应任务 |
|-----------|---------|
| 新增 `GET /api/explore/songs` 公开 API | Task 1 |
| 服务端内存排序（有封面优先） | Task 1 Step 3 |
| 服务端批量签名 | Task 1 Step 3 |
| 每页 18 首 | Task 1 Step 3 (`DEFAULT_LIMIT = 18`) |
| Client Component 无限滚动 | Task 3 |
| IntersectionObserver 自动加载 | Task 3 Step 1 |
| 底部 loading / end 状态 | Task 3 Step 1 |
| ShowcaseCard 向后兼容 | Task 2 |
| 筛选器切换重置加载 | Task 3 Step 1 (`useEffect` on genre/mood) |
| 错误处理（重试按钮） | Task 3 Step 1 |
| explore/page.tsx 改造 | Task 4 |

### 占位符检查

- 无 "TBD"、"TODO"、"implement later"
- 所有步骤包含完整代码或精确命令
- 所有测试包含完整断言

### 类型一致性检查

- `Track` 接口在 API、ShowcaseCard、ExploreSongGrid 中字段一致
- `Pagination` 类型字段名在各处一致
- `hasMore` 布尔类型在各处一致
