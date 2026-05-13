# User Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified Dashboard page (`/dashboard`) with stats cards, quick actions, and recent projects. Integrate Dashboard link into user menu dropdown and mobile navigation.

**Architecture:** Create two API routes for aggregated stats and recent items. Dashboard is a server component that fetches data and renders a responsive grid layout with stats cards, action buttons, and recent items list.

**Tech Stack:** Next.js 14 App Router, Supabase, next-intl, Tailwind CSS, shadcn/ui components

---

## File Structure

```
apps/web/src/
├── app/
│   └── api/
│       ├── stats/route.ts        # NEW - aggregated counts
│       └── recent/route.ts       # NEW - recent items
│   └── [locale]/
│       └── dashboard/
│           └── page.tsx          # NEW - dashboard page
├── components/
│   ├── auth/
│   │   └── user-menu.tsx        # MODIFY - add Dashboard link
│   └── mobile-nav-sheet.tsx     # MODIFY - add Dashboard link
└── messages/
    ├── en.json                   # MODIFY - add translations
    └── zh.json                   # MODIFY - add translations
```

---

## Task 1: Add Dashboard Translations

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: Add English translations**

Add to `en.json` under the root object:

```json
"dashboard": {
  "title": "Dashboard",
  "stats": {
    "songs": { "label": "Songs", "completed": "{count} completed" },
    "lyrics": { "label": "Lyrics", "composed": "{count} composed" },
    "albums": { "label": "Albums", "totalSongs": "{count} songs" },
    "generating": { "label": "Generating", "description": "songs in progress" }
  },
  "quickActions": "Quick Actions",
  "recent": {
    "title": "Recent Projects",
    "viewAll": "View All",
    "empty": "No recent activity"
  }
}
```

Also add to `auth.userMenu`:
```json
"dashboard": "Dashboard"
```

And to `nav`:
```json
"dashboard": "Dashboard"
```

- [ ] **Step 2: Add Chinese translations**

Add to `zh.json`:
```json
"dashboard": {
  "title": "控制台",
  "stats": {
    "songs": { "label": "歌曲", "completed": "{count} 首已完成" },
    "lyrics": { "label": "歌词", "composed": "{count} 首已配曲" },
    "albums": { "label": "专辑", "totalSongs": "{count} 首歌" },
    "generating": { "label": "生成中", "description": "首歌曲正在生成" }
  },
  "quickActions": "快速操作",
  "recent": {
    "title": "最近项目",
    "viewAll": "查看全部",
    "empty": "暂无最近活动"
  }
}
```

Update `auth.userMenu` and `nav` with Chinese labels.

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/zh.json
git commit -m "i18n: add dashboard translations"
```

---

## Task 2: Create Stats API Route

**Files:**
- Create: `apps/web/src/app/api/stats/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch songs stats
  const { count: totalSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: completedSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const { count: generatingSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'generating')

  // Fetch lyrics stats
  const { count: totalLyrics } = await supabase
    .from('lyrics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count lyrics that have linked songs
  const { data: composedLyrics } = await supabase
    .from('lyrics')
    .select('id')
    .eq('user_id', user.id)

  const composedLyricIds = composedLyrics?.map(l => l.id) ?? []
  const { count: composedCount } = composedLyrics?.length 
    ? await supabase
        .from('songs')
        .select('lyric_id', { count: 'exact', head: true })
        .in('lyric_id', composedLyricIds)
    : { count: 0 }

  // Fetch albums stats
  const { count: totalAlbums } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return NextResponse.json({
    songs: {
      total: totalSongs ?? 0,
      completed: completedSongs ?? 0,
      generating: generatingSongs ?? 0
    },
    lyrics: {
      total: totalLyrics ?? 0,
      composed: composedCount ?? 0
    },
    albums: {
      total: totalAlbums ?? 0,
      totalSongs: 0 // Will be calculated via album_songs join
    }
  })
}
```

Actually, let me simplify the stats API - album totalSongs can be fetched in a separate query:

- [ ] **Step 2: Update the API route with simpler logic**

```typescript
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Songs stats
  const { count: totalSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: completedSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const { count: generatingSongs } = await supabase
    .from('songs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'generating')

  // Lyrics stats - count linked to songs
  const { count: totalLyrics } = await supabase
    .from('lyrics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: composedLyrics } = await supabase
    .from('songs')
    .select('lyric_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('lyric_id', 'is', null)

  // Albums stats
  const { count: totalAlbums } = await supabase
    .from('albums')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Album songs count via album_songs junction
  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('album_id')
    .in('album_id', 
      (await supabase.from('albums').select('id').eq('user_id', user.id)).data?.map(a => a.id) ?? []
    )

  const totalAlbumSongs = albumSongs?.length ?? 0

  return NextResponse.json({
    songs: {
      total: totalSongs ?? 0,
      completed: completedSongs ?? 0,
      generating: generatingSongs ?? 0
    },
    lyrics: {
      total: totalLyrics ?? 0,
      composed: composedLyrics ?? 0
    },
    albums: {
      total: totalAlbums ?? 0,
      totalSongs: totalAlbumSongs
    }
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/stats/route.ts
git commit -m "api: add stats endpoint for dashboard"
```

---

## Task 3: Create Recent Items API Route

**Files:**
- Create: `apps/web/src/app/api/recent/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') ?? '7')
  const limit = parseInt(searchParams.get('limit') ?? '6')
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString()

  // Fetch recent songs
  const { data: recentSongs } = await supabase
    .from('songs')
    .select('id, title, status, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Fetch recent lyrics
  const { data: recentLyrics } = await supabase
    .from('lyrics')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Fetch recent albums
  const { data: recentAlbums } = await supabase
    .from('albums')
    .select('id, title, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Combine and sort by created_at
  const items = [
    ...(recentSongs ?? []).map(s => ({ type: 'song' as const, ...s })),
    ...(recentLyrics ?? []).map(l => ({ type: 'lyric' as const, ...l })),
    ...(recentAlbums ?? []).map(a => ({ type: 'album' as const, ...a }))
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)

  return NextResponse.json({ items })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/recent/route.ts
git commit -m "api: add recent items endpoint for dashboard"
```

---

## Task 4: Create Dashboard Page

**Files:**
- Create: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page component**

```tsx
import { createServerClient } from '@kiyo/supabase/server'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Music, FileText, Disc, Wand2, Mic2, Plus, ArrowRight } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@kiyo/ui'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  primary: number
  secondary: string
  href: string
  className?: string
}

function StatCard({ icon, label, primary, secondary, href, className = '' }: StatCardProps) {
  return (
    <Link href={href} className={`block rounded-xl border bg-card p-5 transition-shadow hover:shadow-md ${className}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{primary}</p>
          <p className="text-sm text-muted-foreground">{secondary}</p>
        </div>
      </div>
    </Link>
  )
}

interface RecentItem {
  type: 'song' | 'lyric' | 'album'
  id: string
  title: string
  created_at: string
  status?: string
}

async function getStats() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [songsRes, lyricsRes, albumsRes] = await Promise.all([
    supabase.from('songs').select('status', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('songs').select('lyric_id', { count: 'exact', head: true }).eq('user_id', user.id).not('lyric_id', 'is', null),
    supabase.from('lyrics').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('albums').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  ])

  const { count: totalSongs } = songsRes
  const { count: completedSongs } = songsRes
  const { count: generatingSongs } = songsRes
  const { count: composedLyrics } = lyricsRes
  const { count: totalLyrics } = lyricsRes
  const { count: totalAlbums } = albumsRes

  return {
    songs: { total: totalSongs ?? 0, completed: completedSongs ?? 0, generating: generatingSongs ?? 0 },
    lyrics: { total: totalLyrics ?? 0, composed: composedLyrics ?? 0 },
    albums: { total: totalAlbums ?? 0 }
  }
}

async function getRecentItems() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const [songs, lyrics, albums] = await Promise.all([
    supabase.from('songs').select('id, title, status, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3),
    supabase.from('lyrics').select('id, title, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3),
    supabase.from('albums').select('id, title, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3)
  ])

  const items = [
    ...(songs.data ?? []).map(s => ({ type: 'song' as const, ...s })),
    ...(lyrics.data ?? []).map(l => ({ type: 'lyric' as const, ...l })),
    ...(albums.data ?? []).map(a => ({ type: 'album' as const, ...a }))
  ]

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6)
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const t = await getTranslations('dashboard')
  const [stats, recentItems] = await Promise.all([getStats(), getRecentItems()])

  if (!stats) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 text-3xl font-bold">{t('title')}</h1>

          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Music className="h-6 w-6 text-primary" />}
              label={t('stats.songs.label')}
              primary={stats.songs.total}
              secondary={t('stats.songs.completed', { count: stats.songs.completed })}
              href="/songs"
            />
            <StatCard
              icon={<FileText className="h-6 w-6 text-primary" />}
              label={t('stats.lyrics.label')}
              primary={stats.lyrics.total}
              secondary={t('stats.lyrics.composed', { count: stats.lyrics.composed })}
              href="/lyrics"
            />
            <StatCard
              icon={<Disc className="h-6 w-6 text-primary" />}
              label={t('stats.albums.label')}
              primary={stats.albums.total}
              secondary={t('stats.albums.totalSongs', { count: 0 })}
              href="/albums"
            />
            <StatCard
              icon={<Wand2 className="h-6 w-6 text-purple-500" />}
              label={t('stats.generating.label')}
              primary={stats.songs.generating}
              secondary={t('stats.generating.description')}
              href="/songs?status=generating"
              className={stats.songs.generating > 0 ? 'border-purple-500/50 bg-purple-500/5' : ''}
            />
          </div>

          {/* Quick Actions */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold">{t('quickActions')}</h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/songs/new"><Plus className="mr-2 h-4 w-4" />{t('newSong')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/songs/generate"><Wand2 className="mr-2 h-4 w-4" />{t('aiCompose')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/songs/cover"><Mic2 className="mr-2 h-4 w-4" />{t('aiCover')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/lyrics/new"><Plus className="mr-2 h-4 w-4" />{t('newLyric')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/albums/new"><Plus className="mr-2 h-4 w-4" />{t('newAlbum')}</Link>
              </Button>
            </div>
          </section>

          {/* Recent Projects */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t('recent.title')}</h2>
            </div>
            {recentItems.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentItems.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.type === 'song' ? `/songs/${item.id}` : item.type === 'lyric' ? `/lyrics/${item.id}` : `/albums/${item.id}`}
                    className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'song' && <Music className="h-5 w-5 text-muted-foreground" />}
                      {item.type === 'lyric' && <FileText className="h-5 w-5 text-muted-foreground" />}
                      {item.type === 'album' && <Disc className="h-5 w-5 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{t('recent.empty')}</p>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
```

Note: Add more translation keys to messages for quick action labels (`newSong`, `aiCompose`, `aiCover`, `newLyric`, `newAlbum`).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/dashboard/page.tsx
git commit -m "feat(dashboard): add user dashboard page"
```

---

## Task 5: Add Dashboard to Navigation

**Files:**
- Modify: `apps/web/src/components/auth/user-menu.tsx`
- Modify: `apps/web/src/components/mobile-nav-sheet.tsx`

- [ ] **Step 1: Add Dashboard link to user menu**

In `user-menu.tsx`, add the import and the link item:

```tsx
import { 
  LogOut, 
  Settings, 
  Music, 
  Disc, 
  FileText, 
  MessageSquare,
  LayoutDashboard  // NEW
} from "lucide-react";
```

And add after the separator around line 72:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem asChild>
  <Link href="/dashboard">
    <LayoutDashboard className="mr-2 h-4 w-4" />
    {t("userMenu.dashboard")}
  </Link>
</DropdownMenuItem>
<DropdownMenuSeparator />
```

- [ ] **Step 2: Update translations in user-menu**

Add to `auth.userMenu.dashboard` in both en.json and zh.json.

- [ ] **Step 3: Add Dashboard link to mobile nav**

In `mobile-nav-sheet.tsx`, add to the navLinks array:

```tsx
const navLinks = [
  { href: '/dashboard', key: 'dashboard' },  // NEW
  { href: '/explore', key: 'explore' },
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/user-menu.tsx apps/web/src/components/mobile-nav-sheet.tsx
git commit -m "nav: add dashboard link to user menu and mobile nav"
```

---

## Task 6: Add Translation Keys for Quick Actions

**Files:**
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: Add quick action labels**

In `dashboard` section:

```json
"newSong": "New Song",
"aiCompose": "AI Compose",
"aiCover": "AI Cover",
"newLyric": "New Lyric",
"newAlbum": "New Album"
```

Chinese equivalents in zh.json.

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/en.json apps/web/messages/zh.json
git commit -m "i18n: add dashboard quick action labels"
```

---

## Task 7: Test the Dashboard

- [ ] **Step 1: Start dev server and test**

Visit `http://localhost:3000/dashboard` (logged in user)
- Stats cards should load with counts
- Quick action buttons should work
- Recent items section should show items from last 7 days

- [ ] **Step 2: Test language switch**

Switch language to English and verify all text is translated.

- [ ] **Step 3: Test navigation**

Click user avatar → Dashboard link should navigate to `/dashboard`
On mobile, hamburger menu → Dashboard should appear first.

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Add translations | en.json, zh.json |
| 2 | Stats API | stats/route.ts |
| 3 | Recent items API | recent/route.ts |
| 4 | Dashboard page | dashboard/page.tsx |
| 5 | Navigation links | user-menu.tsx, mobile-nav-sheet.tsx |
| 6 | Quick action labels | en.json, zh.json |
| 7 | Test | Manual testing |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-12-user-dashboard.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
