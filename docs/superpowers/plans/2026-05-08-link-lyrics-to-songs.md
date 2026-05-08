# Issue #26: Link lyrics to songs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全歌词与歌曲关联的前端用户体验：歌词列表标识「已作曲」状态、歌词详情页展示关联歌曲列表、支持一键弹窗生成音乐。

**Architecture:** 复用现有 Server Component 页面做数据获取，新增一个 Client Component 弹窗处理生成交互。零新增 API 端点，零新增数据库迁移。

**Tech Stack:** Next.js App Router, React Server Components, shadcn/ui Dialog, Supabase JS Client, lucide-react

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/app/lyrics/page.tsx` | Modify | 歌词列表页：聚合查询歌曲数量，条件渲染「已作曲」标签 |
| `apps/web/src/app/lyrics/[id]/page.tsx` | Modify | 歌词详情页：查询关联歌曲列表，展示关联歌曲 section，添加弹窗触发按钮 |
| `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx` | Create | Client Component：生成音乐弹窗（表单、提交、错误处理） |

---

### Task 1: 歌词列表页添加「已作曲」标签

**Files:**
- Modify: `apps/web/src/app/lyrics/page.tsx`

- [ ] **Step 1: 修改 Supabase 查询，获取关联歌曲数量**

将 `.select('*')` 改为 `.select('*, songs(count)')`。Supabase 聚合语法会在每个 lyric 对象上返回 `songs: [{ count: number }]`。

修改后的 GET 查询：
```ts
const { data: lyrics, error } = await supabase
  .from('lyrics')
  .select('*, songs(count)')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: 在歌词卡片上添加「已作曲」标签**

在卡片标题右侧，根据 `songs[0]?.count` 的值条件渲染标签：

```tsx
<div className="mb-2 flex items-center gap-2">
  <h3 className="font-semibold">{lyric.title}</h3>
  {lyric.songs?.[0]?.count > 0 && (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
      🎵 已作曲
    </span>
  )}
  <span className={`rounded-full px-2 py-0.5 text-xs ${...}`}>
    {lyric.source === 'ai_generated' ? 'AI' : '手动'}
  </span>
</div>
```

注意：将原有的 `source` 标签和新的「已作曲」标签放在同一行，但保持 `source` 标签的原有样式不变。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check -- --filter=web
```
Expected: PASS（或仅现有错误）

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/lyrics/page.tsx
git commit -m "feat(web): show '已作曲' badge on lyrics list cards"
```

---

### Task 2: 歌词详情页添加关联歌曲列表

**Files:**
- Modify: `apps/web/src/app/lyrics/[id]/page.tsx`

- [ ] **Step 1: 查询关联歌曲列表**

在现有 `lyrics` 查询之后，追加 `songs` 查询：

```ts
const { data: linkedSongs } = await supabase
  .from('songs')
  .select('id, title, status, genre, mood, created_at')
  .eq('lyric_id', params.id)
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: 在歌词内容下方添加「关联歌曲」section**

在 `StructuredBlockEditor` 之后、页面结尾之前插入：

```tsx
<div className="mt-8">
  <h2 className="mb-4 text-lg font-semibold">关联歌曲</h2>
  {linkedSongs && linkedSongs.length > 0 ? (
    <div className="space-y-3">
      {linkedSongs.map((song) => (
        <Link key={song.id} href={`/songs/${song.id}`}>
          <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <span className="font-medium">{song.title}</span>
              <SongStatusBadge status={song.status as any} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {song.genre && <span>{song.genre}</span>}
              {song.mood && <span>{song.mood}</span>}
            </div>
          </div>
        </Link>
      ))}
    </div>
  ) : (
    <div className="rounded-lg border border-dashed p-6 text-center">
      <p className="text-sm text-muted-foreground">暂无关联歌曲</p>
      <p className="mt-1 text-xs text-muted-foreground">使用上方按钮生成音乐</p>
    </div>
  )}
</div>
```

- [ ] **Step 3: 在页面 header 添加「生成音乐」按钮**

在「编辑」按钮旁边（保持原有的编辑按钮不变），新增一个主按钮：

```tsx
<div className="flex items-center gap-2">
  {/* 新增：弹窗触发按钮 —— 先留一个占位按钮，Task 3 换成真正的弹窗组件 */}
  <Button size="sm">
    <Music className="mr-1 h-4 w-4" />
    生成音乐
  </Button>
  <Link href={`/lyrics/${lyric.id}/edit`}>
    <Button variant="outline" size="sm">
      <Pencil className="mr-1 h-4 w-4" />
      编辑
    </Button>
  </Link>
</div>
```

需要导入 `Music` from `lucide-react`。

- [ ] **Step 4: 运行类型检查**

```bash
pnpm type-check -- --filter=web
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/lyrics/[id]/page.tsx
git commit -m "feat(web): show linked songs list on lyric detail page"
```

---

### Task 3: 创建生成音乐弹窗 Client Component

**Files:**
- Create: `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx`

- [ ] **Step 1: 创建弹窗组件文件**

创建 `apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx`：

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  toast,
} from '@kiyo/ui'
import { Music } from 'lucide-react'

const LANGUAGE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
]

interface GenerateSongDialogProps {
  lyricId: string
  lyricTitle: string
  lyricContent: string
  lyricLanguage: string | null
}

export function GenerateSongDialog({
  lyricId,
  lyricTitle,
  lyricContent,
  lyricLanguage,
}: GenerateSongDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState(lyricTitle)
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState(lyricLanguage ?? '')
  const [error, setError] = React.useState('')

  const contentEmpty = !lyricContent || lyricContent.trim() === ''

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('主题描述不能为空')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          mode: 'existing_lyric',
          lyric_id: lyricId,
          genre: genre || undefined,
          mood: mood || undefined,
          language: language || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.song) {
        setOpen(false)
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || '生成失败，请稍后重试')
      }
    } catch {
      setError('生成失败，请检查网络连接')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Music className="mr-1 h-4 w-4" />
        生成音乐
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>基于此歌词生成音乐</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {contentEmpty && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              歌词内容为空，无法生成音乐
            </p>
          )}

          {/* 主题描述 */}
          <div>
            <Label htmlFor="prompt">主题描述 *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的音乐"
              rows={2}
              disabled={generating || contentEmpty}
            />
          </div>

          {/* 风格 + 情绪 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genre">风格（可选）</Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="如：流行"
                disabled={generating || contentEmpty}
              />
            </div>
            <div>
              <Label htmlFor="mood">情绪（可选）</Label>
              <Input
                id="mood"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="如：欢快"
                disabled={generating || contentEmpty}
              />
            </div>
          </div>

          {/* 语言 */}
          <div>
            <Label htmlFor="language">语言（可选）</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={generating || contentEmpty}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 歌词预览 */}
          <div>
            <Label>歌词预览</Label>
            <div className="mt-1 max-h-24 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              {lyricContent.length > 200
                ? lyricContent.slice(0, 200) + '...'
                : lyricContent || '（无内容）'}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={generating}
          >
            取消
          </Button>
          <Button onClick={handleGenerate} disabled={generating || contentEmpty}>
            {generating ? '生成中...' : '开始生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: 运行类型检查**

```bash
pnpm type-check -- --filter=web
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/[id]/generate-song-dialog.tsx
git commit -m "feat(web): add generate-song dialog for lyric detail page"
```

---

### Task 4: 将弹窗接入歌词详情页

**Files:**
- Modify: `apps/web/src/app/lyrics/[id]/page.tsx`

- [ ] **Step 1: 导入弹窗组件**

在 `page.tsx` 顶部添加：

```tsx
import { GenerateSongDialog } from './generate-song-dialog'
```

- [ ] **Step 2: 替换占位按钮为真实弹窗**

将 Task 2 中留的占位按钮替换为 `GenerateSongDialog` 组件：

```tsx
<div className="flex items-center gap-2">
  <GenerateSongDialog
    lyricId={lyric.id}
    lyricTitle={lyric.title}
    lyricContent={lyric.content}
    lyricLanguage={lyric.language}
  />
  <Link href={`/lyrics/${lyric.id}/edit`}>
    <Button variant="outline" size="sm">
      <Pencil className="mr-1 h-4 w-4" />
      编辑
    </Button>
  </Link>
</div>
```

同时删除 `Music` 的 import（如果弹窗组件已经导入了它）。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check -- --filter=web
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/lyrics/[id]/page.tsx
git commit -m "feat(web): wire generate-song dialog into lyric detail page"
```

---

### Task 5: 端到端验证

**Files:**
- 无需修改代码

- [ ] **Step 1: 构建项目**

```bash
pnpm build -- --filter=web
```
Expected: PASS

- [ ] **Step 2: 运行 lint**

```bash
pnpm lint -- --filter=web
```
Expected: PASS（或仅现有 lint 错误）

- [ ] **Step 3: 运行测试**

```bash
pnpm test -- --filter=web
```
Expected: PASS（或仅现有失败）

- [ ] **Step 4: Commit（如有任何格式化修复）**

```bash
git diff --stat
# 如有改动则提交
git add -A && git commit -m "chore: fix formatting/lint after issue #26 changes" || echo "No changes to commit"
```

---

## Self-Review

### Spec Coverage Check

| Spec 需求 | 对应任务 |
|-----------|---------|
| 歌词列表标识「已作曲」 | Task 1 |
| 歌词详情页展示关联歌曲列表 | Task 2 |
| 歌词详情页一键生成音乐弹窗 | Task 3 + Task 4 |
| 弹窗默认填充歌词标题和语言 | Task 3 (default state) |
| 歌词内容为空时禁用提交 | Task 3 (contentEmpty check) |
| 复用现有 `/api/songs/generate` | Task 3 (handleGenerate) |
| 无新增 API 端点 | ✓ 全计划无新 API |

### Placeholder Scan

- 无 "TBD" / "TODO" / "implement later"
- 每步都有完整代码
- 每步都有明确的运行命令和期望输出

### Type Consistency

- `lyric_id` 在弹窗 props、API payload、数据库字段中名称一致
- `status` 在 SongStatusBadge 和 linkedSongs 查询中一致
- `language` 在弹窗默认值、select options、API payload 中一致

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-link-lyrics-to-songs.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
