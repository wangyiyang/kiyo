# AI 翻唱入口可发现性提升 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在歌曲列表卡片、列表页工具栏和落地页 Features 三个触点新增 AI 翻唱入口，提升核心场景的可发现性。

**Architecture:** 纯前端 UI 改动，复用已有的 `/songs/cover` 页面和 `/api/songs/cover` API。SongCard 新增 `onCover` prop，SongsPage 传入导航回调，Features 扩展为 4 张卡片。

**Tech Stack:** React, TypeScript, Tailwind CSS, next-intl, @kiyo/ui, Vitest, @testing-library/react

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `packages/ui/src/components/song-card.tsx` | 修改 | 新增 `onCover` prop，hover 时在右上角显示翻唱按钮 |
| `apps/web/src/app/[locale]/songs/page.tsx` | 修改 | 顶部工具栏新增「AI 翻唱」按钮；给 SongCard 传入 `onCover` 回调 |
| `apps/web/src/components/sections/features.tsx` | 修改 | 扩展为 4 张卡片，新增 `aiCover` feature |
| `apps/web/messages/zh.json` | 修改 | 新增 `songs.list.cover`、`features.items.aiCover` 文案 |
| `apps/web/messages/en.json` | 修改 | 同上，英文翻译 |
| `apps/web/src/components/song-card-cover.test.tsx` | 新建 | SongCard `onCover` 行为的单元测试 |

---

### Task 1: SongCard — 新增 onCover prop

**Files:**
- Modify: `packages/ui/src/components/song-card.tsx`

- [ ] **Step 1: 修改 lucide-react 导入，新增 Mic2**

将导入语句从：
```tsx
import { Music2, Clock, Trash2 } from 'lucide-react'
```
改为：
```tsx
import { Music2, Clock, Trash2, Mic2 } from 'lucide-react'
```

- [ ] **Step 2: 在 SongCardProps 接口中新增 onCover**

将接口从：
```tsx
interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  statusLabel: string
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
  href?: string
  onDelete?: (id: string) => void
}
```
改为：
```tsx
interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  statusLabel: string
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
  href?: string
  onDelete?: (id: string) => void
  onCover?: (id: string) => void
}
```

- [ ] **Step 3: 在函数参数解构中新增 onCover**

将从：
```tsx
export function SongCard({ id, title, status, statusLabel, duration, lyricTitle, coverUrl, href, onDelete }: SongCardProps) {
```
改为：
```tsx
export function SongCard({ id, title, status, statusLabel, duration, lyricTitle, coverUrl, href, onDelete, onCover }: SongCardProps) {
```

- [ ] **Step 4: 替换右上角操作按钮区域**

将现有的删除按钮代码块：
```tsx
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(id)
            }}
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
```
替换为：
```tsx
        {(onDelete || onCover) && (
          <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onCover && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onCover(id)
                }}
                className="rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-purple-600"
                aria-label="翻唱"
              >
                <Mic2 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(id)
                }}
                className="rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/song-card.tsx
git commit -m "feat(ui): add onCover prop to SongCard for quick cover action"
```

---

### Task 2: SongsPage — 新增 AI 翻唱入口

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/page.tsx`

- [ ] **Step 1: 修改 lucide-react 导入，新增 Mic2**

将从：
```tsx
import { Plus, Wand2, ChevronLeft, ChevronRight } from 'lucide-react'
```
改为：
```tsx
import { Plus, Wand2, Mic2, ChevronLeft, ChevronRight } from 'lucide-react'
```

- [ ] **Step 2: 修改 @/i18n/navigation 导入，新增 useRouter**

将从：
```tsx
import { Link } from '@/i18n/navigation'
```
改为：
```tsx
import { Link, useRouter } from '@/i18n/navigation'
```

- [ ] **Step 3: 在组件内获取 router 实例**

在 `const tCommon = useTranslations('common')` 之后添加：
```tsx
  const router = useRouter()
```

- [ ] **Step 4: 在顶部工具栏新增「AI 翻唱」按钮**

将工具栏部分从：
```tsx
        <div className="flex items-center gap-3">
          <Link
            href="/songs/generate"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
```
改为：
```tsx
        <div className="flex items-center gap-3">
          <Link
            href="/songs/generate"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href="/songs/cover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Mic2 className="h-4 w-4" />
            {t('list.cover')}
          </Link>
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
```

- [ ] **Step 5: 给 SongCard 传入 onCover 回调**

将 SongCard 的使用从：
```tsx
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                status={song.status}
                statusLabel={statusLabelMap[song.status] ?? song.status}
                duration={song.duration}
                lyricTitle={song.lyrics?.title ?? null}
                coverUrl={song.cover_url}
                href={`/songs/${song.id}`}
                onDelete={(id) => setDeleteDialog({ open: true, song: songs.find((s) => s.id === id) ?? null })}
              />
```
改为：
```tsx
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                status={song.status}
                statusLabel={statusLabelMap[song.status] ?? song.status}
                duration={song.duration}
                lyricTitle={song.lyrics?.title ?? null}
                coverUrl={song.cover_url}
                href={`/songs/${song.id}`}
                onDelete={(id) => setDeleteDialog({ open: true, song: songs.find((s) => s.id === id) ?? null })}
                onCover={(id) => router.push(`/songs/cover?original_song_id=${id}`)}
              />
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\[locale\]/songs/page.tsx
git commit -m "feat(songs): add AI cover button to toolbar and SongCard actions"
```

---

### Task 3: Features — 扩展为 4 张卡片

**Files:**
- Modify: `apps/web/src/components/sections/features.tsx`

- [ ] **Step 1: 修改 lucide-react 导入，新增 Mic2**

将从：
```tsx
import { Layers, Sparkles, Wand2, type LucideIcon } from 'lucide-react'
```
改为：
```tsx
import { Layers, Sparkles, Wand2, Mic2, type LucideIcon } from 'lucide-react'
```

- [ ] **Step 2: 扩展 featureKeys 和 featureIcons**

将从：
```tsx
const featureKeys = ['multiModel', 'controllable', 'endToEnd'] as const
type FeatureKey = (typeof featureKeys)[number]

const featureIcons: Record<FeatureKey, LucideIcon> = {
  multiModel: Sparkles,
  controllable: Layers,
  endToEnd: Wand2,
}
```
改为：
```tsx
const featureKeys = ['multiModel', 'controllable', 'endToEnd', 'aiCover'] as const
type FeatureKey = (typeof featureKeys)[number]

const featureIcons: Record<FeatureKey, LucideIcon> = {
  multiModel: Sparkles,
  controllable: Layers,
  endToEnd: Wand2,
  aiCover: Mic2,
}
```

- [ ] **Step 3: 调整响应式网格**

将网格容器从：
```tsx
        <div className="mt-14 grid gap-6 md:grid-cols-3">
```
改为：
```tsx
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sections/features.tsx
git commit -m "feat(landing): add aiCover to Features section, expand to 4 cards"
```

---

### Task 4: i18n 文案

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 zh.json**

在 `songs.list` 对象中添加 `"cover": "AI 翻唱"`：

从：
```json
    "list": {
      "title": "歌曲库",
      "new": "新建歌曲",
      "generate": "AI 作曲"
    }
```
改为：
```json
    "list": {
      "title": "歌曲库",
      "new": "新建歌曲",
      "generate": "AI 作曲",
      "cover": "AI 翻唱"
    }
```

在 `features.items` 对象中添加 `aiCover`：

从：
```json
    "items": {
      "multiModel": { ... },
      "controllable": { ... },
      "endToEnd": { ... }
    }
```
改为：
```json
    "items": {
      "multiModel": { ... },
      "controllable": { ... },
      "endToEnd": { ... },
      "aiCover": {
        "title": "AI 翻唱",
        "description": "一键改变风格——流行变爵士、摇滚变民谣，让同一首歌拥有无限可能。"
      }
    }
```

- [ ] **Step 2: 修改 en.json**

在 `songs.list` 对象中添加 `"cover": "AI Cover"`：

从：
```json
    "list": {
      "title": "Songs",
      "new": "New Song",
      "generate": "AI Compose"
    }
```
改为：
```json
    "list": {
      "title": "Songs",
      "new": "New Song",
      "generate": "AI Compose",
      "cover": "AI Cover"
    }
```

在 `features.items` 对象中添加 `aiCover`：

```json
      "aiCover": {
        "title": "AI Cover",
        "description": "Transform any song in one click — pop to jazz, rock to folk. Give your music infinite possibilities."
      }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "i18n: add AI cover translations for songs list and features"
```

---

### Task 5: SongCard onCover 单元测试

**Files:**
- Create: `apps/web/src/components/song-card-cover.test.tsx`

- [ ] **Step 1: 创建测试文件**

写入 `apps/web/src/components/song-card-cover.test.tsx`：

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}))

import { SongCard } from '@kiyo/ui'

describe('SongCard onCover', () => {
  it('renders cover button when onCover is provided', () => {
    const onCover = vi.fn()
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
        onCover={onCover}
      />
    )

    expect(screen.getByRole('button', { name: /翻唱/i })).toBeInTheDocument()
  })

  it('does not render cover button when onCover is omitted', () => {
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
      />
    )

    expect(screen.queryByRole('button', { name: /翻唱/i })).not.toBeInTheDocument()
  })

  it('calls onCover with song id when clicked', () => {
    const onCover = vi.fn()
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
        onCover={onCover}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /翻唱/i }))
    expect(onCover).toHaveBeenCalledWith('s1')
    expect(onCover).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
cd apps/web && pnpm test src/components/song-card-cover.test.tsx
```

期望：3 个测试全部通过。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/song-card-cover.test.tsx
git commit -m "test: add SongCard onCover behavior tests"
```

---

### Task 6: 类型检查与最终验证

- [ ] **Step 1: 运行类型检查**

```bash
pnpm type-check
```

期望：无类型错误。

- [ ] **Step 2: 运行 linter**

```bash
pnpm lint
```

期望：无 lint 错误。

- [ ] **Step 3: 运行完整测试套件**

```bash
pnpm test
```

期望：所有现有测试 + 新增测试全部通过。

- [ ] **Step 4: 最终 Commit（如有 fix）**

如果类型检查或 linter 发现问题，修复后 commit：

```bash
git add -A
git commit -m "fix: resolve type-check and lint issues"
```

---

## 自检清单

1. **Spec 覆盖**：所有设计要求均已映射到任务。
   - ✅ 卡片翻唱按钮 → Task 1
   - ✅ 列表页工具栏 → Task 2
   - ✅ 落地页 Features → Task 3
   - ✅ i18n 文案 → Task 4
   - ✅ 单元测试 → Task 5
   - ✅ 类型/验证 → Task 6

2. **Placeholder 扫描**：无 TBD、TODO、"implement later"。

3. **类型一致性**：
   - `onCover?: (id: string) => void` 在 SongCardProps 和实际调用处一致
   - `features.items.aiCover` 在 zh.json 和 en.json 中结构一致
   - `featureKeys` 和 `featureIcons` 的键名一致