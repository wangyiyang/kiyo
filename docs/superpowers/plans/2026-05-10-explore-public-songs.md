# 公开歌曲探索页实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 `/explore` 公开路由页，展示全部 `is_featured = true` 的 seed 歌曲，支持风格/情绪筛选，首页 Showcase 增加"查看全部歌曲"入口。

**Architecture:** Server Component 从 Supabase 获取公开歌曲数据（利用已有 RLS 策略 `anon_read_featured_songs`），复用现有 `ShowcaseCard`、`ScrollReveal`、`EmptyState` 组件。筛选通过 URL query params 实现，Server Component 直接读取并体现在查询中。

**Tech Stack:** Next.js App Router + Supabase SSR + next-intl + Tailwind CSS

---

## 文件结构

**新建：**
- `apps/web/src/app/[locale]/explore/page.tsx` — 公开歌曲探索页（Server Component）

**修改：**
- `apps/web/src/components/sections/showcase.tsx` — 底部添加"查看全部歌曲"入口

**复用（不修改）：**
- `apps/web/src/components/sections/showcase-card.tsx` — 歌曲卡片，点击播放
- `apps/web/src/components/scroll-reveal.tsx` — 滚动渐入动画
- `@kiyo/ui` 的 `EmptyState` — 空数据状态

---

### Task 1: 创建 explore 页面

**Files:**
- Create: `apps/web/src/app/[locale]/explore/page.tsx`
- Test: 访问 `http://localhost:3000/en/explore`

- [ ] **Step 1: 创建 explore 页面文件**

在 `apps/web/src/app/[locale]/explore/page.tsx` 写入：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { ShowcaseCard } from '@/components/sections/showcase-card'
import { ScrollReveal } from '@/components/scroll-reveal'
import { EmptyState, cn } from '@kiyo/ui'
import { Link } from '@/i18n/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '探索歌曲',
  description: '发现 AI 生成的精选音乐作品',
}

const trackGradients = [
  'from-indigo-500 to-cyan-400',
  'from-amber-400 to-pink-400',
  'from-rose-500 to-violet-500',
  'from-sky-500 to-emerald-400',
  'from-fuchsia-500 to-orange-400',
  'from-purple-400 to-pink-300',
]

interface FeaturedTrack {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  audio_url: string | null
  duration: number | null
}

async function getExploreData(
  genre?: string,
  mood?: string
): Promise<{
  tracks: FeaturedTrack[]
  allGenres: string[]
  allMoods: string[]
}> {
  const supabase = await createServerClient()

  // 获取筛选后的歌曲列表
  let query = supabase
    .from('songs')
    .select('id, title, genre, mood, cover_url, audio_url, duration')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })

  if (genre) query = query.eq('genre', genre)
  if (mood) query = query.eq('mood', mood)

  const { data: tracksData, error: tracksError } = await query

  if (tracksError) {
    console.error('Failed to fetch featured tracks:', tracksError)
    return { tracks: [], allGenres: [], allMoods: [] }
  }

  // 获取所有 genre 和 mood（用于筛选器，不受当前筛选条件影响）
  const { data: allMeta } = await supabase
    .from('songs')
    .select('genre, mood')
    .eq('is_featured', true)

  const allGenres = [
    ...new Set(allMeta?.map((d) => d.genre).filter(Boolean) ?? []),
  ].sort()

  const allMoods = [
    ...new Set(allMeta?.map((d) => d.mood).filter(Boolean) ?? []),
  ].sort()

  return {
    tracks: (tracksData as FeaturedTrack[]) ?? [],
    allGenres,
    allMoods,
  }
}

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; mood?: string }>
}) {
  const { locale } = await params
  const { genre, mood } = await searchParams

  const { tracks, allGenres, allMoods } = await getExploreData(genre, mood)

  const buildUrl = (g?: string, m?: string) => {
    const sp = new URLSearchParams()
    if (g) sp.set('genre', g)
    if (m) sp.set('mood', m)
    const qs = sp.toString()
    return `/${locale}/explore${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="container mx-auto px-4 py-20">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">探索歌曲</h1>
        <p className="mt-2 text-muted-foreground">
          发现 AI 生成的精选音乐作品
        </p>
      </div>

      {/* Genre Filter */}
      {allGenres.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            风格
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildUrl(undefined, mood)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                !genre
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              全部
            </Link>
            {allGenres.map((g) => (
              <Link
                key={g}
                href={buildUrl(g, mood)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  genre === g
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mood Filter */}
      {allMoods.length > 0 && (
        <div className="mb-10">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            情绪
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildUrl(genre, undefined)}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                !mood
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              全部
            </Link>
            {allMoods.map((m) => (
              <Link
                key={m}
                href={buildUrl(genre, m)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm transition-colors',
                  mood === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {m}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {tracks.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, idx) => (
            <ScrollReveal key={track.id} delay={(idx % 3) * 0.08}>
              <ShowcaseCard
                track={track}
                index={idx}
                playlist={tracks}
                gradient={trackGradients[idx % trackGradients.length]}
              />
            </ScrollReveal>
          ))}
        </div>
      ) : (
        <EmptyState
          title="暂无歌曲"
          description="未找到符合条件的歌曲，试试其他筛选条件"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 运行类型检查**

在仓库根目录运行：

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/.worktrees/feat/showcase-seed
pnpm type-check -- --filter=web
```

Expected: 0 errors, 0 warnings（允许已有的 warning）

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/app/\[locale\]/explore/page.tsx
git commit -m "feat(explore): add public songs explore page"
```

---

### Task 2: Showcase 区域添加"查看全部歌曲"入口

**Files:**
- Modify: `apps/web/src/components/sections/showcase.tsx`
- Test: 访问 `http://localhost:3000/en/`，确认 Showcase 底部出现按钮且可点击跳转

- [ ] **Step 1: 修改 showcase.tsx**

在 `apps/web/src/components/sections/showcase.tsx` 中：

1. 在 imports 末尾添加：

```tsx
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
```

2. 在歌曲网格 `</div>` 之后、`</div>`（container）之前，添加：

```tsx
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
          >
            查看全部歌曲
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
```

完整修改后的文件结构参考：

```tsx
import { createClient } from '@supabase/supabase-js'
import { ScrollReveal } from '../scroll-reveal'
import { ShowcaseCard } from './showcase-card'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'

// ... interfaces and gradients unchanged ...

export async function Showcase() {
  const tracks = await getFeaturedTracks()

  if (!tracks || tracks.length === 0) {
    return null
  }

  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        {/* Title - unchanged */}
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          ...
        </ScrollReveal>

        {/* Grid - unchanged */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, idx) => (
            <ScrollReveal key={track.id} delay={(idx % 3) * 0.08}>
              <ShowcaseCard
                track={track}
                index={idx}
                playlist={tracks}
                gradient={trackGradients[idx % trackGradients.length]}
              />
            </ScrollReveal>
          ))}
        </div>

        {/* NEW: View all button */}
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium text-card-foreground transition-colors hover:bg-accent"
          >
            查看全部歌曲
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 运行类型检查**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/.worktrees/feat/showcase-seed
pnpm type-check -- --filter=web
```

Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/components/sections/showcase.tsx
git commit -m "feat(showcase): add explore page link"
```

---

## 验证清单

所有任务完成后：

- [ ] `pnpm dev` 启动后，访问 `http://localhost:3000/en/explore`
- [ ] 页面展示全部 featured 歌曲（不登录也可访问）
- [ ] 点击风格/情绪筛选标签，URL 变化且歌曲列表更新
- [ ] 点击歌曲卡片，MiniPlayer 出现并播放
- [ ] 访问首页 `http://localhost:3000/en/`，Showcase 底部有"查看全部歌曲"按钮
- [ ] 点击按钮正确跳转到 `/en/explore`
- [ ] `pnpm type-check -- --filter=web` 无错误
