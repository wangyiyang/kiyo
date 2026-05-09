# Next.js Image 组件优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `packages/ui` 中的 5 个组件的 `<img>` 标签替换为 `next/image` 的 `Image` 组件

**Architecture:** 使用 Next.js Image 组件配合精确的 `sizes` 配置和 `bg-muted` 骨架屏 fallback，实现图片自动优化、懒加载、WebP/AVIF 转换。

**Tech Stack:** Next.js Image, React, TypeScript, Tailwind CSS

---

## 文件变更概览

| 任务 | 文件 | 变更类型 |
|------|------|---------|
| Task 1 | `packages/ui/src/components/song-card.tsx` | 修改 |
| Task 2 | `packages/ui/src/components/album-card.tsx` | 修改 |
| Task 3 | `packages/ui/src/components/audio-player/AudioPlayer.tsx` | 修改 |
| Task 4 | `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | 修改 |
| Task 5 | `packages/ui/src/components/audio-player/MiniPlayer.tsx` | 修改 |

---

## Task 1: SongCard 组件

**Files:**
- Modify: `packages/ui/src/components/song-card.tsx`

- [ ] **Step 1: 添加 Image import**

在文件顶部添加 `next/image` import：
```tsx
import Image from 'next/image'
```

- [ ] **Step 2: 替换 img 为 Image 组件**

找到这行：
```tsx
<img
  src={coverUrl}
  alt={title}
  className="h-full w-full object-cover transition-transform group-hover:scale-105"
/>
```

替换为：
```tsx
<Image
  src={coverUrl}
  alt={title}
  fill
  className="object-cover transition-transform group-hover:scale-105"
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
/>
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter @kiyo/ui type-check`
预期：无错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add packages/ui/src/components/song-card.tsx
git commit -m "feat(ui): use Next.js Image in SongCard (#61)"
```

---

## Task 2: AlbumCard 组件

**Files:**
- Modify: `packages/ui/src/components/album-card.tsx`

- [ ] **Step 1: 添加 Image import**

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: 替换 img 为 Image 组件**

找到这行：
```tsx
<img src={coverUrl} alt={title} className="h-full w-full object-cover" />
```

替换为：
```tsx
<Image
  src={coverUrl}
  alt={title}
  fill
  className="object-cover"
  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
/>
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter @kiyo/ui type-check`
预期：无错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add packages/ui/src/components/album-card.tsx
git commit -m "feat(ui): use Next.js Image in AlbumCard (#61)"
```

---

## Task 3: AudioPlayer 组件

**Files:**
- Modify: `packages/ui/src/components/audio-player/AudioPlayer.tsx`

- [ ] **Step 1: 添加 Image import**

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: 替换 img 为 Image 组件**

找到这行：
```tsx
<img src={coverUrl} alt={title} className="h-full w-full object-cover" />
```

替换为：
```tsx
<Image
  src={coverUrl}
  alt={title || '未知歌曲'}
  width={80}
  height={80}
  className="object-cover"
  sizes="80px"
/>
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter @kiyo/ui type-check`
预期：无错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add packages/ui/src/components/audio-player/AudioPlayer.tsx
git commit -m "feat(ui): use Next.js Image in AudioPlayer (#61)"
```

---

## Task 4: PlaylistPanel 组件

**Files:**
- Modify: `packages/ui/src/components/audio-player/PlaylistPanel.tsx`

- [ ] **Step 1: 添加 Image import**

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: 替换 img 为 Image 组件**

找到这行：
```tsx
<img
  src={song.cover_url}
  alt={song.title}
  className="h-full w-full rounded object-cover"
/>
```

替换为：
```tsx
<Image
  src={song.cover_url}
  alt={song.title}
  width={32}
  height={32}
  className="rounded object-cover"
  sizes="32px"
/>
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter @kiyo/ui type-check`
预期：无错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add packages/ui/src/components/audio-player/PlaylistPanel.tsx
git commit -m "feat(ui): use Next.js Image in PlaylistPanel (#61)"
```

---

## Task 5: MiniPlayer 组件

**Files:**
- Modify: `packages/ui/src/components/audio-player/MiniPlayer.tsx`

- [ ] **Step 1: 添加 Image import**

```tsx
import Image from 'next/image'
```

- [ ] **Step 2: 替换 img 为 Image 组件**

找到这行：
```tsx
<img
  src={currentTrack.cover_url}
  alt={currentTrack.title}
  className="h-full w-full object-cover"
/>
```

替换为：
```tsx
<Image
  src={currentTrack.cover_url}
  alt={currentTrack.title}
  width={40}
  height={40}
  className="object-cover"
  sizes="40px"
/>
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter @kiyo/ui type-check`
预期：无错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add packages/ui/src/components/audio-player/MiniPlayer.tsx
git commit -m "feat(ui): use Next.js Image in MiniPlayer (#61)"
```

---

## Task 6: 全量验证

**Files:**
- Build: `apps/web`
- Type Check: `packages/ui`

- [ ] **Step 1: 运行全量类型检查**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm type-check`
预期：无 TypeScript 错误

- [ ] **Step 2: 运行构建验证**

运行：`cd /Users/wangyiyang/Documents/Github/kiyo && pnpm build`
预期：构建成功，无错误

- [ ] **Step 3: 提交所有变更**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add -A
git commit -m "refactor(ui): migrate all img tags to Next.js Image (#61)"
```

---

## 验收标准

- [ ] `pnpm type-check` 通过
- [ ] `pnpm build` 成功
- [ ] 所有图片正常显示，无 404 错误
- [ ] 无布局偏移（CLS 改善）

---

## 回滚计划

如遇问题，执行：
```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git log --oneline -10
# 找到合并提交前的一个 commit
git reset --hard <commit-hash>
```
