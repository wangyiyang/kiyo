# 底部播放器可访问名称修复（#137）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为底部播放器所有交互按钮补齐 `aria-label`，支持中英文 i18n 切换。

**Architecture:** `@kiyo/ui` 播放器组件接收可选 `labels` prop，内部为每个按钮设置动态 `aria-label`；`apps/web` 通过 `next-intl` 翻译后传入。RSC 页面用 `getTranslations`，客户端组件用 `useTranslations`。组件保留英文硬编码 fallback。

**Tech Stack:** React 18, TypeScript, next-intl, Tailwind CSS, Zustand

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/ui/src/components/audio-player/PlayerControls.tsx` | 播放控制按钮组，接收 `labels` prop 设置 `aria-label` |
| `packages/ui/src/components/audio-player/VolumeControl.tsx` | 音量控制，接收 `labels` prop 设置 `aria-label` |
| `packages/ui/src/components/audio-player/MiniPlayer.tsx` | 底部迷你播放器，接收 `labels` prop 设置 `aria-label` |
| `packages/ui/src/components/audio-player/AudioPlayer.tsx` | 内嵌播放器，接收 `labels` prop 并拆分给子组件 |
| `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | 播放列表面板，接收 `labels` prop 设置列表项 `aria-label` |
| `packages/ui/src/components/audio-player/ProgressBar.tsx` | 进度条，新增 `ariaLabel` prop |
| `apps/web/messages/zh.json` | 新增 `player` 翻译命名空间 |
| `apps/web/messages/en.json` | 新增 `player` 翻译命名空间 |
| `apps/web/src/components/global-player.tsx` | 客户端组件，用 `useTranslations('player')` 注入 labels |
| `apps/web/src/app/[locale]/songs/[id]/page.tsx` | RSC，用 `getTranslations('player')` 注入 labels |
| `apps/web/src/app/[locale]/songs/[id]/public/page.tsx` | RSC，同上 |
| `apps/web/src/app/[locale]/albums/[id]/page.tsx` | RSC，同上 |
| `apps/web/src/app/[locale]/albums/[id]/public/page.tsx` | RSC，同上 |

---

### Task 1: 修复 messages 中的 merge conflict

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

**说明：** 两个文件顶部存在未解决的 Git merge conflict（`<<<<<<< HEAD`）。保留 `dashboard` 和 `settings` 两项。

- [ ] **Step 1: 修复 zh.json 的 conflict**

将：
```json
<<<<<<< HEAD
    "dashboard": "控制台"
=======
    "settings": "设置"
>>>>>>> b3ef3f2283a1e2dbe7167dc287aed1bbc87411ee
```
替换为：
```json
    "dashboard": "控制台",
    "settings": "设置"
```

- [ ] **Step 2: 修复 en.json 的 conflict**

将：
```json
<<<<<<< HEAD
    "dashboard": "Dashboard"
=======
    "settings": "Settings"
>>>>>>> b3ef3f2283a1e2dbe7167dc287aed1bbc87411ee
```
替换为：
```json
    "dashboard": "Dashboard",
    "settings": "Settings"
```

- [ ] **Step 3: 验证 JSON 有效性**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh.json')); console.log('zh OK')"`
Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json')); console.log('en OK')"`
Expected: 两行都输出 OK

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "fix(i18n): resolve merge conflict in messages"
```

---

### Task 2: 添加 PlayerControls labels 和 aria-label

**Files:**
- Modify: `packages/ui/src/components/audio-player/PlayerControls.tsx`

- [ ] **Step 1: 修改 PlayerControls.tsx**

在文件顶部（`interface PlayerControlsProps` 之前）添加：

```ts
export interface PlayerControlsLabels {
  shuffle?: string
  prev?: string
  next?: string
  play?: string
  pause?: string
  repeat?: string
  repeatOne?: string
}
```

修改 `PlayerControlsProps`：
```ts
interface PlayerControlsProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  labels?: PlayerControlsLabels
}
```

修改函数签名：
```ts
export function PlayerControls({ className, size = 'md', labels = {} }: PlayerControlsProps) {
```

在每个 `<button>` 上添加 `aria-label`：

1. shuffle button: `aria-label={labels.shuffle ?? 'Shuffle'}`
2. prev button: `aria-label={labels.prev ?? 'Previous'}`
3. play/pause button: `aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}`
4. next button: `aria-label={labels.next ?? 'Next'}`
5. repeat button: `aria-label={repeatMode === 'one' ? (labels.repeatOne ?? 'Repeat one') : (labels.repeat ?? 'Repeat')}`

完整修改后的 `PlayerControls.tsx`：

```tsx
'use client'

import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

export interface PlayerControlsLabels {
  shuffle?: string
  prev?: string
  next?: string
  play?: string
  pause?: string
  repeat?: string
  repeatOne?: string
}

interface PlayerControlsProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  labels?: PlayerControlsLabels
}

export function PlayerControls({ className, size = 'md', labels = {} }: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const repeatMode = usePlayerStore((s) => s.repeatMode)
  const isShuffle = usePlayerStore((s) => s.isShuffle)
  const playlist = usePlayerStore((s) => s.playlist)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)

  const hasPlaylist = playlist.length > 0

  const btnSize =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const playSize =
    size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 24 : 18
  const playIconSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 24

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <button
        onClick={toggleShuffle}
        aria-label={labels.shuffle ?? 'Shuffle'}
        className={cn(
          'flex items-center justify-center rounded-full text-white/60 transition hover:text-white',
          btnSize,
          isShuffle && 'text-primary'
        )}
        title="随机播放"
      >
        <Shuffle size={iconSize} />
      </button>

      <button
        onClick={prev}
        disabled={!hasPlaylist}
        aria-label={labels.prev ?? 'Previous'}
        className={cn(
          'flex items-center justify-center rounded-full text-white/80 transition hover:text-white disabled:opacity-30',
          btnSize
        )}
        title="上一首 (P)"
      >
        <SkipBack size={iconSize} />
      </button>

      <button
        onClick={togglePlay}
        aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}
        className={cn(
          'flex items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105',
          playSize
        )}
        title="播放/暂停 (Space)"
      >
        {isPlaying ? <Pause size={playIconSize} /> : <Play size={playIconSize} className="ml-0.5" />}
      </button>

      <button
        onClick={next}
        disabled={!hasPlaylist}
        aria-label={labels.next ?? 'Next'}
        className={cn(
          'flex items-center justify-center rounded-full text-white/80 transition hover:text-white disabled:opacity-30',
          btnSize
        )}
        title="下一首 (N)"
      >
        <SkipForward size={iconSize} />
      </button>

      <button
        onClick={cycleRepeatMode}
        aria-label={repeatMode === 'one' ? (labels.repeatOne ?? 'Repeat one') : (labels.repeat ?? 'Repeat')}
        className={cn(
          'flex items-center justify-center rounded-full text-white/60 transition hover:text-white',
          btnSize,
          repeatMode !== 'off' && 'text-primary'
        )}
        title="循环模式"
      >
        {repeatMode === 'one' ? <Repeat1 size={iconSize} /> : <Repeat size={iconSize} />}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/PlayerControls.tsx
git commit -m "feat(a11y): add aria-label and labels prop to PlayerControls"
```

---

### Task 3: 添加 VolumeControl labels 和 aria-label

**Files:**
- Modify: `packages/ui/src/components/audio-player/VolumeControl.tsx`

- [ ] **Step 1: 修改 VolumeControl.tsx**

在文件顶部添加：

```ts
export interface VolumeControlLabels {
  mute?: string
  unmute?: string
  volume?: string
}
```

修改 `VolumeControlProps`：
```ts
interface VolumeControlProps {
  className?: string
  labels?: VolumeControlLabels
}
```

修改函数签名：
```ts
export function VolumeControl({ className, labels = {} }: VolumeControlProps) {
```

修改 mute button：`aria-label={isMuted || displayVolume === 0 ? (labels.unmute ?? 'Unmute') : (labels.mute ?? 'Mute')}`
修改 input range：`aria-label={labels.volume ?? 'Volume'}`

完整修改后的 `VolumeControl.tsx`：

```tsx
'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

export interface VolumeControlLabels {
  mute?: string
  unmute?: string
  volume?: string
}

interface VolumeControlProps {
  className?: string
  labels?: VolumeControlLabels
}

export function VolumeControl({ className, labels = {} }: VolumeControlProps) {
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

  const displayVolume = isMuted ? 0 : volume

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={toggleMute}
        aria-label={isMuted || displayVolume === 0 ? (labels.unmute ?? 'Unmute') : (labels.mute ?? 'Mute')}
        className="text-white/60 transition hover:text-white"
        title="静音 (M)"
      >
        {isMuted || displayVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <div className="relative h-1 w-20 cursor-pointer rounded-full bg-white/10">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/60 transition-all"
          style={{ width: `${displayVolume * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={displayVolume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          aria-label={labels.volume ?? 'Volume'}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/VolumeControl.tsx
git commit -m "feat(a11y): add aria-label and labels prop to VolumeControl"
```

---

### Task 4: 添加 PlaylistPanel labels 和 aria-label

**Files:**
- Modify: `packages/ui/src/components/audio-player/PlaylistPanel.tsx`

- [ ] **Step 1: 修改 PlaylistPanel.tsx**

在文件顶部添加：

```ts
export interface PlaylistPanelLabels {
  empty?: string
  playSong?: string
  playingIndicator?: string
}
```

修改 `PlaylistPanelProps`：
```ts
interface PlaylistPanelProps {
  className?: string
  labels?: PlaylistPanelLabels
}
```

修改函数签名：
```ts
export function PlaylistPanel({ className, labels = {} }: PlaylistPanelProps) {
```

修改空列表文案：
```tsx
{labels.empty ?? '暂无播放队列'}
```

为每个 `<li>` 添加 `aria-label`：
```tsx
aria-label={isActive ? (labels.playingIndicator ? labels.playingIndicator.replace('{title}', song.title) : `Playing ${song.title}`) : (labels.playSong ? labels.playSong.replace('{title}', song.title) : `Play ${song.title}`)}
```

完整修改后的 `PlaylistPanel.tsx`：

```tsx
'use client'

import Image from 'next/image'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Music2 } from 'lucide-react'

export interface PlaylistPanelLabels {
  empty?: string
  playSong?: string
  playingIndicator?: string
}

interface PlaylistPanelProps {
  className?: string
  labels?: PlaylistPanelLabels
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlaylistPanel({ className, labels = {} }: PlaylistPanelProps) {
  const playlist = usePlayerStore((s) => s.playlist)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const play = usePlayerStore((s) => s.play)
  const playlistLength = playlist.length

  if (playlistLength === 0) {
    return (
      <div className={cn('p-4 text-center text-sm text-white/40', className)}>
        {labels.empty ?? '暂无播放队列'}
      </div>
    )
  }

  return (
    <div className={cn('max-h-60 overflow-y-auto', className)}>
      <div className="px-3 py-2 text-xs font-medium text-white/40">
        播放队列 ({playlistLength})
      </div>
      <ul className="space-y-0.5">
        {playlist.map((song, index) => {
          const isActive = currentTrack?.id === song.id
          const ariaLabel = isActive
            ? (labels.playingIndicator ? labels.playingIndicator.replace('{title}', song.title) : `Playing ${song.title}`)
            : (labels.playSong ? labels.playSong.replace('{title}', song.title) : `Play ${song.title}`)
          return (
            <li
              key={song.id}
              onClick={() => play(song, playlist)}
              aria-label={ariaLabel}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              )}
            >
              <span className="w-5 text-right text-xs tabular-nums">
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1.5 w-0.5 animate-pulse bg-primary" />
                    <span className="h-2 w-0.5 animate-pulse bg-primary [animation-delay:0.1s]" />
                    <span className="h-1 w-0.5 animate-pulse bg-primary [animation-delay:0.2s]" />
                  </span>
                ) : (
                  index + 1
                )}
              </span>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5">
                {song.cover_url ? (
                  <Image
                    src={song.cover_url}
                    alt={song.title}
                    width={32}
                    height={32}
                    className="rounded object-cover"
                    sizes="32px"
                  />
                ) : (
                  <Music2 size={14} className="text-white/30" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{song.title}</div>
                {song.album && (
                  <div className="truncate text-xs text-white/40">{song.album}</div>
                )}
              </div>

              <span className="text-xs text-white/40 tabular-nums">
                {formatDuration(song.duration)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/PlaylistPanel.tsx
git commit -m "feat(a11y): add aria-label and labels prop to PlaylistPanel"
```

---

### Task 5: 添加 ProgressBar ariaLabel

**Files:**
- Modify: `packages/ui/src/components/audio-player/ProgressBar.tsx`

- [ ] **Step 1: 修改 ProgressBar.tsx**

修改 `ProgressBarProps`：
```ts
interface ProgressBarProps {
  className?: string
  ariaLabel?: string
}
```

修改函数签名：
```ts
export function ProgressBar({ className, ariaLabel = 'Progress' }: ProgressBarProps) {
```

在进度条容器 `<div ref={barRef}>` 上添加：
```tsx
role="slider"
aria-label={ariaLabel}
aria-valuemin={0}
aria-valuemax={duration}
aria-valuenow={currentTime}
tabIndex={0}
```

完整修改后的 `ProgressBar.tsx`：

```tsx
'use client'

import { useCallback, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface ProgressBarProps {
  className?: string
  ariaLabel?: string
}

export function ProgressBar({ className, ariaLabel = 'Progress' }: ProgressBarProps) {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const barRef = useRef<HTMLDivElement>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current
      if (!bar || duration <= 0) return
      const rect = bar.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      seek(ratio * duration)
    },
    [duration, seek]
  )

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={barRef}
        onClick={handleClick}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        className="group relative h-1.5 cursor-pointer rounded-full bg-white/10"
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
          style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/ProgressBar.tsx
git commit -m "feat(a11y): add aria-label and slider role to ProgressBar"
```

---

### Task 6: 添加 MiniPlayer labels 和 aria-label

**Files:**
- Modify: `packages/ui/src/components/audio-player/MiniPlayer.tsx`

- [ ] **Step 1: 修改 MiniPlayer.tsx**

在文件顶部添加：

```ts
export interface MiniPlayerLabels {
  prev?: string
  next?: string
  play?: string
  pause?: string
  expand?: string
  collapse?: string
  close?: string
}
```

修改 `MiniPlayer` 函数签名，添加 `labels` 参数：
```ts
export function MiniPlayer({ labels = {} }: { labels?: MiniPlayerLabels } = {}) {
```

为以下按钮添加 `aria-label`：
1. cover button: `aria-label={isExpanded ? (labels.collapse ?? 'Collapse player') : (labels.expand ?? 'Expand player')}`
2. prev button: `aria-label={labels.prev ?? 'Previous'}`
3. play/pause button: `aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}`
4. next button: `aria-label={labels.next ?? 'Next'}`
5. expand button: `aria-label={isExpanded ? (labels.collapse ?? 'Collapse player') : (labels.expand ?? 'Expand player')}`
6. close button: `aria-label={labels.close ?? 'Close player'}`

完整修改后的 `MiniPlayer.tsx`：

```tsx
'use client'

import Image from 'next/image'
import { usePlayerStore } from '../../store/usePlayerStore'
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, X, Music2 } from 'lucide-react'
import { PlaylistPanel } from './PlaylistPanel'
import { ProgressBar } from './ProgressBar'

export interface MiniPlayerLabels {
  prev?: string
  next?: string
  play?: string
  pause?: string
  expand?: string
  collapse?: string
  close?: string
}

export function MiniPlayer({ labels = {} }: { labels?: MiniPlayerLabels } = {}) {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isVisible = usePlayerStore((s) => s.isMiniPlayerVisible)
  const isExpanded = usePlayerStore((s) => s.isMiniPlayerExpanded)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const setMiniPlayerExpanded = usePlayerStore((s) => s.setMiniPlayerExpanded)
  const stopAndHide = usePlayerStore((s) => s.stopAndHide)

  if (!isVisible || !currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/90 backdrop-blur-md">
      {/* Collapsed bar */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Cover */}
        <button
          onClick={() => setMiniPlayerExpanded(!isExpanded)}
          aria-label={isExpanded ? (labels.collapse ?? 'Collapse player') : (labels.expand ?? 'Expand player')}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/5"
        >
          {currentTrack.cover_url ? (
            <Image
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              width={40}
              height={40}
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 size={16} className="text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {currentTrack.title}
          </div>
          <div className="truncate text-xs text-white/50">
            {currentTrack.album || '未知专辑'}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            aria-label={labels.prev ?? 'Previous'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={next}
            aria-label={labels.next ?? 'Next'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Mini progress */}
        <div className="hidden w-20 sm:block">
          <ProgressBar />
        </div>

        {/* Expand / Close */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMiniPlayerExpanded(!isExpanded)}
            aria-label={isExpanded ? (labels.collapse ?? 'Collapse player') : (labels.expand ?? 'Expand player')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:text-white"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={stopAndHide}
            aria-label={labels.close ?? 'Close player'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expanded playlist panel */}
      {isExpanded && (
        <div className="border-t border-white/5">
          <PlaylistPanel className="py-2" />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/MiniPlayer.tsx
git commit -m "feat(a11y): add aria-label and labels prop to MiniPlayer"
```

---

### Task 7: 添加 AudioPlayer labels 和 aria-label

**Files:**
- Modify: `packages/ui/src/components/audio-player/AudioPlayer.tsx`
- Modify: `packages/ui/src/components/audio-player/index.ts`

- [ ] **Step 1: 修改 AudioPlayer.tsx**

在文件顶部（`AudioPlayerProps` 之前）添加：

```ts
import { PlayerControlsLabels } from './PlayerControls'
import { VolumeControlLabels } from './VolumeControl'
import { PlaylistPanelLabels } from './PlaylistPanel'

export interface AudioPlayerLabels {
  play?: string
  pause?: string
  playlist?: string
  prev?: string
  next?: string
  shuffle?: string
  repeat?: string
  repeatOne?: string
  mute?: string
  unmute?: string
  volume?: string
  empty?: string
  playSong?: string
  playingIndicator?: string
}
```

修改 `AudioPlayerProps`：
```ts
export interface AudioPlayerProps {
  src: string
  filePath?: string | null
  title?: string
  album?: string
  coverUrl?: string | null
  coverFilePath?: string | null
  duration?: number | null
  songId?: string
  playlist?: Array<{
    id: string
    title: string
    audio_url: string
    file_path?: string | null
    cover_url?: string | null
    duration?: number | null
    album?: string | null
  }>
  className?: string
  labels?: AudioPlayerLabels
}
```

修改函数签名：
```ts
export function AudioPlayer({
  src,
  filePath,
  title,
  album,
  coverUrl,
  coverFilePath,
  duration,
  songId,
  playlist,
  className,
  labels = {},
}: AudioPlayerProps) {
```

为 cover overlay play button 添加 `aria-label`：
```tsx
aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}
```

为 playlist button 添加 `aria-label`：
```tsx
aria-label={labels.playlist ?? 'Playlist'}
```

将 labels 拆分传递给子组件：
```tsx
<PlayerControls size="lg" labels={{
  shuffle: labels.shuffle,
  prev: labels.prev,
  next: labels.next,
  play: labels.play,
  pause: labels.pause,
  repeat: labels.repeat,
  repeatOne: labels.repeatOne,
}} />
<VolumeControl labels={{
  mute: labels.mute,
  unmute: labels.unmute,
  volume: labels.volume,
}} />
```

为 PlaylistPanel 传递 labels：
```tsx
<PlaylistPanel labels={{
  empty: labels.empty,
  playSong: labels.playSong,
  playingIndicator: labels.playingIndicator,
}} />
```

完整修改后的 `AudioPlayer.tsx`：

```tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Play, Pause, ListMusic, Music2 } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { PlayerControls } from './PlayerControls'
import { VolumeControl } from './VolumeControl'
import { SpectrumVisualizer } from './SpectrumVisualizer'
import { PlaylistPanel } from './PlaylistPanel'

export interface AudioPlayerLabels {
  play?: string
  pause?: string
  playlist?: string
  prev?: string
  next?: string
  shuffle?: string
  repeat?: string
  repeatOne?: string
  mute?: string
  unmute?: string
  volume?: string
  empty?: string
  playSong?: string
  playingIndicator?: string
}

export interface AudioPlayerProps {
  src: string
  filePath?: string | null
  title?: string
  album?: string
  coverUrl?: string | null
  coverFilePath?: string | null
  duration?: number | null
  songId?: string
  playlist?: Array<{
    id: string
    title: string
    audio_url: string
    file_path?: string | null
    cover_url?: string | null
    duration?: number | null
    album?: string | null
  }>
  className?: string
  labels?: AudioPlayerLabels
}

export function AudioPlayer({
  src,
  filePath,
  title,
  album,
  coverUrl,
  coverFilePath,
  duration,
  songId,
  playlist,
  className,
  labels = {},
}: AudioPlayerProps) {
  const store = usePlayerStore()
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(coverUrl || null)

  useEffect(() => {
    if (coverUrl) {
      setResolvedCoverUrl(coverUrl)
    } else if (coverFilePath) {
      fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'covers', path: coverFilePath }),
      })
        .then((res) => res.json())
        .then((data) => setResolvedCoverUrl(data.signedUrl || null))
        .catch(() => setResolvedCoverUrl(null))
    } else {
      setResolvedCoverUrl(null)
    }
  }, [coverFilePath, coverUrl])

  const isCurrentTrack = store.currentTrack?.audio_url === src || (filePath ? store.currentTrack?.file_path === filePath : false)
  const isPlaying = isCurrentTrack && store.isPlaying

  const handlePlay = () => {
    if (isCurrentTrack) {
      store.togglePlay()
      return
    }

    const song = {
      id: songId || src,
      title: title || '未知歌曲',
      audio_url: src,
      file_path: filePath || undefined,
      cover_url: resolvedCoverUrl,
      duration,
      album: album || undefined,
    }

    const pl = playlist?.map((s) => ({
      id: s.id,
      title: s.title,
      audio_url: s.audio_url,
      file_path: s.file_path || undefined,
      cover_url: s.cover_url,
      duration: s.duration,
      album: s.album || undefined,
    })) || [song]

    store.play(song, pl)
  }

  const playerControlsLabels = {
    shuffle: labels.shuffle,
    prev: labels.prev,
    next: labels.next,
    play: labels.play,
    pause: labels.pause,
    repeat: labels.repeat,
    repeatOne: labels.repeatOne,
  }

  const volumeControlLabels = {
    mute: labels.mute,
    unmute: labels.unmute,
    volume: labels.volume,
  }

  const playlistPanelLabels = {
    empty: labels.empty,
    playSong: labels.playSong,
    playingIndicator: labels.playingIndicator,
  }

  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-b from-neutral-900 to-black p-6 text-white',
        className
      )}
    >
      {/* Header: Cover + Info */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {resolvedCoverUrl ? (
            <Image
            src={resolvedCoverUrl}
            alt={title || '未知歌曲'}
            width={80}
            height={80}
            className="object-cover"
            sizes="80px"
          />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 size={28} className="text-white/30" />
            </div>
          )}
          <button
            onClick={handlePlay}
            aria-label={isPlaying ? (labels.pause ?? 'Pause') : (labels.play ?? 'Play')}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{title || '未知歌曲'}</h3>
          {album && <p className="truncate text-sm text-white/50">{album}</p>}
        </div>
      </div>

      {/* Visualizer */}
      <div className="mb-4">
        <SpectrumVisualizer className="h-16 rounded-lg bg-white/5" />
      </div>

      {/* Progress */}
      {isCurrentTrack && (
        <div className="mb-4">
          <ProgressBar />
        </div>
      )}

      {/* Controls */}
      <div className="mb-4">
        <PlayerControls size="lg" labels={playerControlsLabels} />
      </div>

      {/* Bottom row: Volume + Playlist toggle */}
      <div className="flex items-center justify-between">
        <VolumeControl labels={volumeControlLabels} />
        {playlist && playlist.length > 0 && (
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            aria-label={labels.playlist ?? 'Playlist'}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
              showPlaylist
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <ListMusic size={16} />
            播放列表 ({playlist.length})
          </button>
        )}
      </div>

      {/* Playlist */}
      {showPlaylist && playlist && playlist.length > 0 && (
        <div className="mt-4 rounded-lg bg-white/5">
          <PlaylistPanel labels={playlistPanelLabels} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 确认 index.ts 已导出 AudioPlayerLabels**

检查 `packages/ui/src/components/audio-player/index.ts` 确保它重新导出 `AudioPlayer`。由于 `AudioPlayer.tsx` 使用 named export，且 `index.ts` 已 `export * from './AudioPlayer'`，`AudioPlayerLabels` 会自动导出。无需修改。

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/audio-player/AudioPlayer.tsx
git commit -m "feat(a11y): add aria-label and labels prop to AudioPlayer"
```

---

### Task 8: 在 messages 中添加 player 翻译命名空间

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 zh.json**

在 zh.json 的顶层添加 `player` 命名空间（建议放在 `dashboard` 之后）：

```json
  "player": {
    "prev": "上一首",
    "next": "下一首",
    "play": "播放",
    "pause": "暂停",
    "shuffle": "随机播放",
    "repeat": "循环播放",
    "repeatOne": "单曲循环",
    "mute": "静音",
    "unmute": "取消静音",
    "volume": "音量",
    "expand": "展开播放器",
    "collapse": "收起播放器",
    "close": "关闭播放器",
    "playlist": "播放列表",
    "playSong": "播放 {title}",
    "playingIndicator": "正在播放 {title}"
  }
```

- [ ] **Step 2: 修改 en.json**

在 en.json 的顶层添加相同的 `player` 命名空间：

```json
  "player": {
    "prev": "Previous",
    "next": "Next",
    "play": "Play",
    "pause": "Pause",
    "shuffle": "Shuffle",
    "repeat": "Repeat",
    "repeatOne": "Repeat one",
    "mute": "Mute",
    "unmute": "Unmute",
    "volume": "Volume",
    "expand": "Expand player",
    "collapse": "Collapse player",
    "close": "Close player",
    "playlist": "Playlist",
    "playSong": "Play {title}",
    "playingIndicator": "Playing {title}"
  }
```

- [ ] **Step 3: 验证 JSON 有效性**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh.json')); console.log('zh OK')"`
Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json')); console.log('en OK')"`
Expected: 两行都输出 OK

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add player aria-label translations"
```

---

### Task 9: 在 global-player.tsx 中注入 labels

**Files:**
- Modify: `apps/web/src/components/global-player.tsx`

- [ ] **Step 1: 修改 global-player.tsx**

```tsx
'use client'

import { AudioEngine, MiniPlayer, usePlayerKeyboard } from '@kiyo/ui'
import { useTranslations } from 'next-intl'

export function GlobalPlayer() {
  usePlayerKeyboard()
  const t = useTranslations('player')

  return (
    <>
      <AudioEngine />
      <MiniPlayer
        labels={{
          prev: t('prev'),
          next: t('next'),
          play: t('play'),
          pause: t('pause'),
          expand: t('expand'),
          collapse: t('collapse'),
          close: t('close'),
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/global-player.tsx
git commit -m "feat(a11y): inject i18n labels into MiniPlayer"
```

---

### Task 10: 在 songs/[id]/page.tsx 中注入 labels

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/[id]/page.tsx`

- [ ] **Step 1: 修改 songs/[id]/page.tsx**

在函数顶部添加：
```ts
const tPlayer = await getTranslations('player')
```

为第一个 `<AudioPlayer>` 添加 `labels`：
```tsx
<AudioPlayer
  src={song.audio_url || ''}
  filePath={song.file_path}
  title={song.title}
  duration={song.duration}
  coverUrl={song.cover_url}
  coverFilePath={song.cover_file_path}
  songId={song.id}
  className="w-full"
  labels={{
    play: tPlayer('play'),
    pause: tPlayer('pause'),
    playlist: tPlayer('playlist'),
    prev: tPlayer('prev'),
    next: tPlayer('next'),
    shuffle: tPlayer('shuffle'),
    repeat: tPlayer('repeat'),
    repeatOne: tPlayer('repeatOne'),
    mute: tPlayer('mute'),
    unmute: tPlayer('unmute'),
    volume: tPlayer('volume'),
    empty: tPlayer('empty'),
    playSong: tPlayer('playSong'),
    playingIndicator: tPlayer('playingIndicator'),
  }}
/>
```

为 original song 的 `<AudioPlayer>` 添加同样的 `labels`。

为 cover song 的 `<AudioPlayer>` 添加同样的 `labels`。

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/[id]/page.tsx
git commit -m "feat(a11y): inject i18n labels into AudioPlayer on song detail page"
```

---

### Task 11: 在 songs/[id]/public/page.tsx 中注入 labels

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/[id]/public/page.tsx`

- [ ] **Step 1: 修改 songs/[id]/public/page.tsx**

在函数顶部添加：
```ts
const tPlayer = await getTranslations('player')
```

为 `<AudioPlayer>` 添加 `labels`：
```tsx
<AudioPlayer
  src={song.audio_url || ''}
  filePath={song.file_path}
  title={song.title}
  duration={song.duration}
  coverUrl={song.cover_url}
  coverFilePath={song.cover_file_path}
  songId={song.id}
  className="w-full"
  labels={{
    play: tPlayer('play'),
    pause: tPlayer('pause'),
    playlist: tPlayer('playlist'),
    prev: tPlayer('prev'),
    next: tPlayer('next'),
    shuffle: tPlayer('shuffle'),
    repeat: tPlayer('repeat'),
    repeatOne: tPlayer('repeatOne'),
    mute: tPlayer('mute'),
    unmute: tPlayer('unmute'),
    volume: tPlayer('volume'),
    empty: tPlayer('empty'),
    playSong: tPlayer('playSong'),
    playingIndicator: tPlayer('playingIndicator'),
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/[id]/public/page.tsx
git commit -m "feat(a11y): inject i18n labels into AudioPlayer on public song page"
```

---

### Task 12: 在 albums/[id]/page.tsx 中注入 labels

**Files:**
- Modify: `apps/web/src/app/[locale]/albums/[id]/page.tsx`

- [ ] **Step 1: 修改 albums/[id]/page.tsx**

在函数顶部添加：
```ts
const tPlayer = await getTranslations('player')
```

为 `<AudioPlayer>` 添加 `labels`：
```tsx
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
  labels={{
    play: tPlayer('play'),
    pause: tPlayer('pause'),
    playlist: tPlayer('playlist'),
    prev: tPlayer('prev'),
    next: tPlayer('next'),
    shuffle: tPlayer('shuffle'),
    repeat: tPlayer('repeat'),
    repeatOne: tPlayer('repeatOne'),
    mute: tPlayer('mute'),
    unmute: tPlayer('unmute'),
    volume: tPlayer('volume'),
    empty: tPlayer('empty'),
    playSong: tPlayer('playSong'),
    playingIndicator: tPlayer('playingIndicator'),
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/albums/[id]/page.tsx
git commit -m "feat(a11y): inject i18n labels into AudioPlayer on album detail page"
```

---

### Task 13: 在 albums/[id]/public/page.tsx 中注入 labels

**Files:**
- Modify: `apps/web/src/app/[locale]/albums/[id]/public/page.tsx`

- [ ] **Step 1: 修改 albums/[id]/public/page.tsx**

在函数顶部添加：
```ts
const tPlayer = await getTranslations('player')
```

为 `<AudioPlayer>` 添加 `labels`：
```tsx
<AudioPlayer
  src={playableSongs[0]?.audio_url || ''}
  filePath={playableSongs[0]?.file_path}
  title={playableSongs[0]?.title}
  album={album.title}
  coverUrl={album.cover_url}
  coverFilePath={album.cover_file_path}
  songId={playableSongs[0]?.id}
  playlist={playableSongs.map((s: any) => ({
    id: s.id,
    title: s.title,
    audio_url: s.audio_url || '',
    file_path: s.file_path,
    cover_url: s.cover_url,
    duration: s.duration,
    album: album.title,
  }))}
  className="w-full"
  labels={{
    play: tPlayer('play'),
    pause: tPlayer('pause'),
    playlist: tPlayer('playlist'),
    prev: tPlayer('prev'),
    next: tPlayer('next'),
    shuffle: tPlayer('shuffle'),
    repeat: tPlayer('repeat'),
    repeatOne: tPlayer('repeatOne'),
    mute: tPlayer('mute'),
    unmute: tPlayer('unmute'),
    volume: tPlayer('volume'),
    empty: tPlayer('empty'),
    playSong: tPlayer('playSong'),
    playingIndicator: tPlayer('playingIndicator'),
  }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/albums/[id]/public/page.tsx
git commit -m "feat(a11y): inject i18n labels into AudioPlayer on public album page"
```

---

### Task 14: 类型检查和验证

- [ ] **Step 1: 运行类型检查**

Run: `pnpm type-check`
Expected: 无新增类型错误。注意检查 `packages/ui` 和 `apps/web` 两个 workspace。

Run: `pnpm --filter @kiyo/ui type-check`
Expected: PASS

Run: `pnpm --filter web type-check`
Expected: PASS

- [ ] **Step 2: 运行 lint**

Run: `pnpm lint`
Expected: 无新增 lint 错误

- [ ] **Step 3: 浏览器可访问性验证（手动）**

1. 启动开发服务器：`pnpm --filter web dev`
2. 访问 `/explore`，点击任意歌曲开始播放。
3. 打开 Chrome DevTools → Elements → Accessibility 面板。
4. 检查底部播放器 MiniPlayer 的每个按钮，确认 Accessible Name 非空且为中文。
5. 切换到英文语言（URL 前缀 `/en/`），刷新页面，确认 Accessible Name 变为英文。
6. 检查 AudioPlayer（歌曲详情页），重复上述验证。

- [ ] **Step 4: Commit 任何修复**

如果类型检查或 lint 发现问题，修复后 commit。

---

## Spec 覆盖检查

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 播放器所有交互按钮均有可访问名称 | Task 2-7 |
| 播放/暂停状态变化时名称同步变化 | Task 2, 6, 7（动态 aria-label） |
| 中英文语言切换后 aria 文案变化 | Task 8-13（next-intl + labels prop） |
| 保持 `@kiyo/ui` 与 next-intl 解耦 | 整体方案（props 传入） |
| 组件保留英文 fallback | Task 2-7（`labels.foo ?? 'Fallback'`） |
| 修复 messages merge conflict | Task 1 |

## Placeholder 检查

计划中没有 TBD、TODO、"implement later"、"add appropriate error handling" 等占位符。所有代码均为完整可执行代码。

## 类型一致性检查

- `PlayerControlsLabels`、`VolumeControlLabels`、`PlaylistPanelLabels`、`AudioPlayerLabels`、`MiniPlayerLabels` 在各文件中保持一致。
- `AudioPlayer` 的 `labels` prop 向下拆分传递给子组件时，字段名称匹配。
- RSC 页面使用 `getTranslations('player')`，客户端组件使用 `useTranslations('player')`，均正确。
