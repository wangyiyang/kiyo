# 自定义音频播放器体验 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将原生 `<audio controls>` 替换为基于 Howler.js + Zustand 的完整自定义音频播放器系统，包含沉浸式主播放器、底部迷你播放器、全局键盘快捷键、播放列表和 Canvas 频谱可视化。

**Architecture:** 全局 Zustand Store 持有播放状态（当前歌曲、播放列表、进度、音量）。`AudioEngine` 是一个无头 React 组件，通过 `useRef` 管理 Howler 实例，将音频事件同步到 Store。所有 UI 组件从 Store 读取状态，不直接操作 Howler。`GlobalPlayer` 组件（`AudioEngine` + `MiniPlayer` + 键盘 Hook）挂载在根布局的 Client Component 中，确保跨页面播放不中断。

**Tech Stack:** Howler.js, Zustand, Web Audio API, React, TypeScript, Next.js App Router, shadcn/ui, @dnd-kit

---

## 文件结构总览

| 文件 | 职责 |
|------|------|
| `packages/ui/src/store/usePlayerStore.ts` | Zustand store：播放状态、播放列表、Actions |
| `packages/ui/src/hooks/usePlayerKeyboard.ts` | 全局键盘快捷键监听 |
| `packages/ui/src/components/audio-player/AudioEngine.tsx` | Howler 实例生命周期管理（无头组件） |
| `packages/ui/src/components/audio-player/ProgressBar.tsx` | 进度条 + 当前/总时间显示 |
| `packages/ui/src/components/audio-player/PlayerControls.tsx` | 播放/暂停/上一首/下一首/循环/随机按钮组 |
| `packages/ui/src/components/audio-player/VolumeControl.tsx` | 音量滑块 + 静音切换 |
| `packages/ui/src/components/audio-player/SpectrumVisualizer.tsx` | Canvas 频谱柱状图动画 |
| `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | 播放列表面板（歌曲列表 + 点击切换） |
| `packages/ui/src/components/audio-player/MiniPlayer.tsx` | 底部固定迷你播放器（收起/展开态） |
| `packages/ui/src/components/audio-player/AudioPlayer.tsx` | 主播放器（全页沉浸式，用于歌曲/专辑页） |
| `packages/ui/src/components/audio-player/index.ts` | 统一导出 |
| `apps/web/src/components/global-player.tsx` | 客户端 wrapper：AudioEngine + MiniPlayer + KeyboardShortcuts |
| `apps/web/src/app/providers.tsx` | 挂载 GlobalPlayer |
| `apps/web/src/app/songs/[id]/page.tsx` | 替换 AudioPlayer 为新版，点击播放写入 store |
| `apps/web/src/app/albums/[id]/page.tsx` | 添加"播放专辑"按钮 |

---

## Task 1: 安装依赖

**Files:**
- Modify: `packages/ui/package.json`

**说明:** 在 `packages/ui` 中添加 `howler`、`zustand`、`@types/howler`。`@dnd-kit/core` 和 `@dnd-kit/sortable` 已在 `apps/web` 中安装，但由于 PlaylistPanel 属于 `packages/ui` 的组件，也需要在 `packages/ui` 中声明为依赖（pnpm workspace 会正确解析）。

- [ ] **Step 1: 修改 package.json**

在 `packages/ui/package.json` 的 `dependencies` 中添加：

```json
    "howler": "^2.2.4",
    "zustand": "^4.5.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2"
```

在 `devDependencies` 中添加：

```json
    "@types/howler": "^2.2.11"
```

- [ ] **Step 2: 安装依赖**

```bash
cd /Users/wangyiyang/.pi/agent/worktrees/root/root/Users/wangyiyang/Documents/Github/kiyo/worktrees/feat-custom-audio-player
pnpm install
```

Expected: 依赖安装成功，无错误。

- [ ] **Step 3: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml
git commit -m "chore: add howler, zustand, dnd-kit deps for custom audio player"
```

---

## Task 2: Zustand Store

**Files:**
- Create: `packages/ui/src/store/usePlayerStore.ts`

**说明:** 全局状态中心。Howler 实例不进入 Store，通过 `AudioEngine` 的 `useRef` 外挂。Store 只持有可序列化的纯数据和 Actions。

- [ ] **Step 1: 创建 usePlayerStore.ts**

```typescript
'use client'

import { create } from 'zustand'

export interface PlayerSong {
  id: string
  title: string
  audio_url: string
  cover_url?: string | null
  duration?: number | null
  album?: string | null
}

export type RepeatMode = 'off' | 'one' | 'all'

interface PlayerState {
  // Playback state
  isPlaying: boolean
  currentTrack: PlayerSong | null
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean

  // Playlist
  playlist: PlayerSong[]
  currentIndex: number
  repeatMode: RepeatMode
  isShuffle: boolean

  // Mini player UI
  isMiniPlayerVisible: boolean
  isMiniPlayerExpanded: boolean

  // Visualizer data
  analyserData: Uint8Array | null

  // Actions
  play: (song: PlayerSong, playlist?: PlayerSong[]) => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  next: () => void
  prev: () => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
  setMiniPlayerExpanded: (expanded: boolean) => void
  updatePlaylistOrder: (songs: PlayerSong[]) => void
  setAnalyserData: (data: Uint8Array | null) => void
  stopAndHide: () => void
}

function getShuffledIndex(currentIndex: number, length: number): number {
  if (length <= 1) return 0
  let nextIndex = Math.floor(Math.random() * length)
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * length)
  }
  return nextIndex
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  isPlaying: false,
  currentTrack: null,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playlist: [],
  currentIndex: -1,
  repeatMode: 'off',
  isShuffle: false,
  isMiniPlayerVisible: false,
  isMiniPlayerExpanded: false,
  analyserData: null,

  play: (song, playlist) => {
    const pl = playlist ?? get().playlist
    const index = pl.findIndex((s) => s.id === song.id)
    set({
      currentTrack: song,
      playlist: pl,
      currentIndex: index >= 0 ? index : -1,
      isPlaying: true,
      isMiniPlayerVisible: true,
      currentTime: 0,
      duration: song.duration ?? 0,
    })
  },

  pause: () => set({ isPlaying: false }),

  togglePlay: () => {
    const { currentTrack, isPlaying } = get()
    if (!currentTrack) return
    set({ isPlaying: !isPlaying })
  },

  seek: (time) => {
    const { duration } = get()
    const clamped = Math.max(0, Math.min(time, duration))
    set({ currentTime: clamped })
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  next: () => {
    const { playlist, currentIndex, repeatMode, isShuffle } = get()
    if (playlist.length === 0) return

    if (repeatMode === 'one') {
      set({ currentTime: 0, isPlaying: true })
      return
    }

    let nextIndex: number
    if (isShuffle) {
      nextIndex = getShuffledIndex(currentIndex, playlist.length)
    } else {
      nextIndex = currentIndex + 1
      if (nextIndex >= playlist.length) {
        nextIndex = repeatMode === 'all' ? 0 : currentIndex
      }
    }

    const nextTrack = playlist[nextIndex]
    if (nextTrack) {
      set({
        currentTrack: nextTrack,
        currentIndex: nextIndex,
        currentTime: 0,
        isPlaying: true,
      })
    }
  },

  prev: () => {
    const { playlist, currentIndex, isShuffle } = get()
    if (playlist.length === 0) return

    let prevIndex: number
    if (isShuffle) {
      prevIndex = getShuffledIndex(currentIndex, playlist.length)
    } else {
      prevIndex = currentIndex - 1
      if (prevIndex < 0) prevIndex = 0
    }

    const prevTrack = playlist[prevIndex]
    if (prevTrack) {
      set({
        currentTrack: prevTrack,
        currentIndex: prevIndex,
        currentTime: 0,
        isPlaying: true,
      })
    }
  },

  setVolume: (vol) => {
    const clamped = Math.max(0, Math.min(1, vol))
    set({ volume: clamped, isMuted: clamped === 0 })
  },

  toggleMute: () => {
    const { isMuted, volume } = get()
    if (isMuted) {
      set({ isMuted: false, volume: volume > 0 ? volume : 0.8 })
    } else {
      set({ isMuted: true })
    }
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),

  cycleRepeatMode: () =>
    set((state) => ({
      repeatMode: state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off',
    })),

  setMiniPlayerExpanded: (expanded) => set({ isMiniPlayerExpanded: expanded }),

  updatePlaylistOrder: (songs) => {
    const { currentTrack } = get()
    const newIndex = currentTrack ? songs.findIndex((s) => s.id === currentTrack.id) : -1
    set({ playlist: songs, currentIndex: newIndex })
  },

  setAnalyserData: (data) => set({ analyserData: data }),

  stopAndHide: () =>
    set({
      isPlaying: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
      isMiniPlayerVisible: false,
      isMiniPlayerExpanded: false,
      analyserData: null,
    }),
}))
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/store/usePlayerStore.ts
git commit -m "feat: add Zustand player store"
```

---

## Task 3: 键盘快捷键 Hook

**Files:**
- Create: `packages/ui/src/hooks/usePlayerKeyboard.ts`

- [ ] **Step 1: 创建 usePlayerKeyboard.ts**

```typescript
'use client'

import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '../store/usePlayerStore'

function isTextInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable
  )
}

export function usePlayerKeyboard() {
  const store = usePlayerStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isTextInputElement(e.target)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          store.togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          store.seek(store.currentTime + 5)
          break
        case 'ArrowLeft':
          e.preventDefault()
          store.seek(store.currentTime - 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          store.setVolume(store.volume + 0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          store.setVolume(store.volume - 0.1)
          break
        case 'n':
        case 'N':
          store.next()
          break
        case 'p':
        case 'P':
          store.prev()
          break
        case 'm':
        case 'M':
          store.toggleMute()
          break
      }
    },
    [store]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/hooks/usePlayerKeyboard.ts
git commit -m "feat: add keyboard shortcuts hook for player"
```

---

## Task 4: AudioEngine（Howler 桥接）

**Files:**
- Create: `packages/ui/src/components/audio-player/AudioEngine.tsx`

**说明:** 无头组件，不渲染任何 UI。负责 Howler 实例的生命周期：创建/卸载、播放/暂停同步、音量同步、seek 同步、进度循环、FFT 数据读取。

- [ ] **Step 1: 创建 AudioEngine.tsx**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Howl, Howler } from 'howler'
import { usePlayerStore } from '../../store/usePlayerStore'

const SEEK_DEBOUNCE_MS = 150

export function AudioEngine() {
  const howlRef = useRef<Howl | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSeekTime = useRef<number>(0)

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.isMuted ? 0 : s.volume)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setAnalyserData = usePlayerStore((s) => s.setAnalyserData)
  const next = usePlayerStore((s) => s.next)

  // Create / switch Howl when currentTrack changes
  useEffect(() => {
    if (!currentTrack?.audio_url) {
      howlRef.current?.unload()
      howlRef.current = null
      analyserRef.current = null
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
      cancelAnimationFrame(rafRef.current)
      setAnalyserData(null)
      return
    }

    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)

    const howl = new Howl({
      src: [currentTrack.audio_url],
      html5: true,
      volume,
      onload: () => {
        setDuration(howl.duration())
      },
      onend: () => {
        next()
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
        // Could dispatch toast here if store supported it
      },
    })

    howlRef.current = howl

    if (isPlaying) {
      howl.play()
      startProgressLoop()
      startVisualizer()
    }

    return () => {
      howl.unload()
      cancelAnimationFrame(rafRef.current)
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.audio_url])

  // Sync play / pause
  useEffect(() => {
    const howl = howlRef.current
    if (!howl || !currentTrack) return

    if (isPlaying) {
      if (!howl.playing()) {
        howl.play()
        startProgressLoop()
        startVisualizer()
      }
    } else {
      if (howl.playing()) {
        howl.pause()
        stopProgressLoop()
        stopVisualizer()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Sync volume
  useEffect(() => {
    howlRef.current?.volume(volume)
  }, [volume])

  // Sync seek from store -> Howl
  useEffect(() => {
    const howl = howlRef.current
    if (!howl || !currentTrack) return

    const now = Date.now()
    if (now - lastSeekTime.current < SEEK_DEBOUNCE_MS) return
    lastSeekTime.current = now

    const currentHowlTime = howl.seek() as number
    if (Math.abs(currentHowlTime - currentTime) > 1) {
      howl.seek(currentTime)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime])

  function startProgressLoop() {
    stopProgressLoop()
    progressIntervalRef.current = setInterval(() => {
      const howl = howlRef.current
      if (!howl || !howl.playing()) return
      const seek = howl.seek() as number
      setCurrentTime(seek)
    }, 250)
  }

  function stopProgressLoop() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  function startVisualizer() {
    const ctx = Howler.ctx
    if (!ctx) return

    try {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      Howler.masterGain.connect(analyser)
      analyserRef.current = analyser

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        rafRef.current = requestAnimationFrame(draw)
        analyser.getByteFrequencyData(dataArray)
        setAnalyserData(new Uint8Array(dataArray))
      }

      draw()
    } catch (e) {
      console.warn('Web Audio visualizer init failed:', e)
    }
  }

  function stopVisualizer() {
    cancelAnimationFrame(rafRef.current)
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        // ignore
      }
      analyserRef.current = null
    }
    setAnalyserData(null)
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/AudioEngine.tsx
git commit -m "feat: add AudioEngine Howler bridge component"
```

---

## Task 5: 进度条 + 控制按钮 + 音量控制

**Files:**
- Create: `packages/ui/src/components/audio-player/ProgressBar.tsx`
- Create: `packages/ui/src/components/audio-player/PlayerControls.tsx`
- Create: `packages/ui/src/components/audio-player/VolumeControl.tsx`

### ProgressBar

- [ ] **Step 1: 创建 ProgressBar.tsx**

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
}

export function ProgressBar({ className }: ProgressBarProps) {
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

### PlayerControls

- [ ] **Step 2: 创建 PlayerControls.tsx**

```tsx
'use client'

import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface PlayerControlsProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PlayerControls({ className, size = 'md' }: PlayerControlsProps) {
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

### VolumeControl

- [ ] **Step 3: 创建 VolumeControl.tsx**

```tsx
'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface VolumeControlProps {
  className?: string
}

export function VolumeControl({ className }: VolumeControlProps) {
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

  const displayVolume = isMuted ? 0 : volume

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={toggleMute}
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
          aria-label="音量"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/audio-player/ProgressBar.tsx packages/ui/src/components/audio-player/PlayerControls.tsx packages/ui/src/components/audio-player/VolumeControl.tsx
git commit -m "feat: add ProgressBar, PlayerControls, VolumeControl components"
```

---

## Task 6: 频谱可视化

**Files:**
- Create: `packages/ui/src/components/audio-player/SpectrumVisualizer.tsx`

- [ ] **Step 1: 创建 SpectrumVisualizer.tsx**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface SpectrumVisualizerProps {
  className?: string
  barCount?: number
}

const FFT_SIZE = 256
const DEFAULT_BAR_COUNT = 48
const SMOOTHING = 0.7

export function SpectrumVisualizer({
  className,
  barCount = DEFAULT_BAR_COUNT,
}: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevHeightsRef = useRef<number[]>(new Array(barCount).fill(0))
  const analyserData = usePlayerStore((s) => s.analyserData)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number

    const draw = () => {
      raf = requestAnimationFrame(draw)

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      if (!analyserData || !isPlaying) {
        // Draw flat lines when not playing
        const barWidth = width / barCount
        const gap = 2
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth + gap / 2
          const h = 2
          const y = height - h
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(x, y, barWidth - gap, h)
        }
        return
      }

      const binCount = analyserData.length
      const barsPerBin = Math.floor(binCount / barCount)
      const barWidth = width / barCount
      const gap = 2

      for (let i = 0; i < barCount; i++) {
        let sum = 0
        const start = i * barsPerBin
        const end = Math.min(start + barsPerBin, binCount)
        for (let j = start; j < end; j++) {
          sum += analyserData[j]
        }
        const avg = sum / (end - start)
        const targetHeight = (avg / 255) * height * 0.9

        const smoothed =
          SMOOTHING * prevHeightsRef.current[i] +
          (1 - SMOOTHING) * targetHeight

        prevHeightsRef.current[i] = smoothed

        const x = i * barWidth + gap / 2
        const h = Math.max(2, smoothed)
        const y = height - h

        const gradient = ctx.createLinearGradient(0, height, 0, y)
        gradient.addColorStop(0, '#ec4899')
        gradient.addColorStop(1, '#8b5cf6')
        ctx.fillStyle = gradient
        ctx.fillRect(x, y, barWidth - gap, h)
      }
    }

    draw()

    return () => cancelAnimationFrame(raf)
  }, [analyserData, isPlaying, barCount])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={80}
      className={cn('w-full', className)}
      style={{ imageRendering: 'auto' }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/SpectrumVisualizer.tsx
git commit -m "feat: add Canvas spectrum visualizer component"
```

---

## Task 7: 播放列表面板

**Files:**
- Create: `packages/ui/src/components/audio-player/PlaylistPanel.tsx`

**说明:** 先实现无拖拽的基础版本（点击切换 + 当前播放高亮），拖拽排序作为后续增强。保持实现简单，满足核心需求。

- [ ] **Step 1: 创建 PlaylistPanel.tsx**

```tsx
'use client'

import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Music2 } from 'lucide-react'

interface PlaylistPanelProps {
  className?: string
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlaylistPanel({ className }: PlaylistPanelProps) {
  const playlist = usePlayerStore((s) => s.playlist)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const currentIndex = usePlayerStore((s) => s.currentIndex)
  const play = usePlayerStore((s) => s.play)
  const playlistLength = playlist.length

  if (playlistLength === 0) {
    return (
      <div className={cn('p-4 text-center text-sm text-white/40', className)}>
        暂无播放队列
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
          return (
            <li
              key={song.id}
              onClick={() => play(song, playlist)}
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
                  <img
                    src={song.cover_url}
                    alt={song.title}
                    className="h-full w-full rounded object-cover"
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
git commit -m "feat: add PlaylistPanel component"
```

---

## Task 8: 迷你播放器

**Files:**
- Create: `packages/ui/src/components/audio-player/MiniPlayer.tsx`

**说明:** 底部固定栏。收起态显示封面+信息+控制按钮；展开态额外显示播放列表。

- [ ] **Step 1: 创建 MiniPlayer.tsx**

```tsx
'use client'

import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, X, Music2 } from 'lucide-react'
import { PlaylistPanel } from './PlaylistPanel'
import { ProgressBar } from './ProgressBar'

export function MiniPlayer() {
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
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/5"
        >
          {currentTrack.cover_url ? (
            <img
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className="h-full w-full object-cover"
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
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={next}
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
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:text-white"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={stopAndHide}
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
git commit -m "feat: add MiniPlayer fixed bottom bar"
```

---

## Task 9: 主播放器

**Files:**
- Create: `packages/ui/src/components/audio-player/AudioPlayer.tsx`

**说明:** 全页沉浸式播放器，用于歌曲详情页和专辑页。替换旧的 `audio-player.tsx`。

- [ ] **Step 1: 创建 AudioPlayer.tsx（新路径）**

```tsx
'use client'

import { useState } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Play, Pause, ListMusic, Music2 } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { PlayerControls } from './PlayerControls'
import { VolumeControl } from './VolumeControl'
import { SpectrumVisualizer } from './SpectrumVisualizer'
import { PlaylistPanel } from './PlaylistPanel'

export interface AudioPlayerProps {
  src: string
  title?: string
  album?: string
  coverUrl?: string | null
  duration?: number | null
  songId?: string
  playlist?: Array<{
    id: string
    title: string
    audio_url: string
    cover_url?: string | null
    duration?: number | null
    album?: string | null
  }>
  className?: string
}

export function AudioPlayer({
  src,
  title,
  album,
  coverUrl,
  duration,
  songId,
  playlist,
  className,
}: AudioPlayerProps) {
  const store = usePlayerStore()
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [showVisualizer, setShowVisualizer] = useState(true)

  const isCurrentTrack = store.currentTrack?.audio_url === src
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
      cover_url: coverUrl,
      duration,
      album: album || undefined,
    }

    const pl = playlist?.map((s) => ({
      id: s.id,
      title: s.title,
      audio_url: s.audio_url,
      cover_url: s.cover_url,
      duration: s.duration,
      album: s.album || undefined,
    })) || [song]

    store.play(song, pl)
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
          {coverUrl ? (
            <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 size={28} className="text-white/30" />
            </div>
          )}
          <button
            onClick={handlePlay}
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
      {showVisualizer && (
        <div className="mb-4">
          <SpectrumVisualizer className="h-16 rounded-lg bg-white/5" />
        </div>
      )}

      {/* Progress */}
      {isCurrentTrack && (
        <div className="mb-4">
          <ProgressBar />
        </div>
      )}

      {/* Controls */}
      <div className="mb-4">
        <PlayerControls size="lg" />
      </div>

      {/* Bottom row: Volume + Playlist toggle */}
      <div className="flex items-center justify-between">
        <VolumeControl />
        {playlist && playlist.length > 0 && (
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
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
          <PlaylistPanel />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/components/audio-player/AudioPlayer.tsx
git commit -m "feat: add immersive AudioPlayer component"
```

---

## Task 10: 统一导出 + 清理旧文件

**Files:**
- Create: `packages/ui/src/components/audio-player/index.ts`
- Modify: `packages/ui/index.ts`
- Delete: `packages/ui/src/components/audio-player.tsx`（旧文件）

- [ ] **Step 1: 创建 index.ts**

```typescript
export { AudioEngine } from './AudioEngine'
export { AudioPlayer } from './AudioPlayer'
export { MiniPlayer } from './MiniPlayer'
export { PlayerControls } from './PlayerControls'
export { ProgressBar } from './ProgressBar'
export { VolumeControl } from './VolumeControl'
export { SpectrumVisualizer } from './SpectrumVisualizer'
export { PlaylistPanel } from './PlaylistPanel'
```

- [ ] **Step 2: 更新 packages/ui/index.ts**

将这一行：
```typescript
export { AudioPlayer } from './src/components/audio-player'
```

替换为：
```typescript
export { AudioPlayer, AudioEngine, MiniPlayer, PlayerControls, ProgressBar, VolumeControl, SpectrumVisualizer, PlaylistPanel } from './src/components/audio-player'
```

- [ ] **Step 3: 删除旧文件**

```bash
rm packages/ui/src/components/audio-player.tsx
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/audio-player/index.ts packages/ui/index.ts
git rm packages/ui/src/components/audio-player.tsx
git commit -m "refactor: replace old audio-player with new component suite"
```

---

## Task 11: GlobalPlayer + 根布局挂载

**Files:**
- Create: `apps/web/src/components/global-player.tsx`
- Modify: `apps/web/src/app/providers.tsx`

- [ ] **Step 1: 创建 global-player.tsx**

```tsx
'use client'

import { AudioEngine, MiniPlayer, usePlayerKeyboard } from '@kiyo/ui'

export function GlobalPlayer() {
  usePlayerKeyboard()

  return (
    <>
      <AudioEngine />
      <MiniPlayer />
    </>
  )
}
```

- [ ] **Step 2: 更新 providers.tsx**

在 `WaitlistProvider` 的 children 中，在 `Toaster` 之前添加 `<GlobalPlayer />`：

```tsx
import { GlobalPlayer } from '@/components/global-player'

// ... inside return:
<WaitlistProvider>
  {children}
  <GlobalPlayer />
  <Toaster richColors closeButton position="top-center" />
</WaitlistProvider>
```

修改后的 `providers.tsx` 完整内容：

```tsx
'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'

import { Toaster } from '@kiyo/ui'

import { WaitlistDialog } from '@/components/waitlist-dialog'
import { GlobalPlayer } from '@/components/global-player'
import { WaitlistProvider } from '@/lib/waitlist-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WaitlistProvider>
        {children}
        <GlobalPlayer />
        <WaitlistDialog />
        <Toaster richColors closeButton position="top-center" />
      </WaitlistProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/global-player.tsx apps/web/src/app/providers.tsx
git commit -m "feat: mount GlobalPlayer in root layout for cross-page playback"
```

---

## Task 12: 歌曲详情页集成

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`

**说明:** 替换旧的 `AudioPlayer` 调用，将歌曲信息传入新版播放器。翻唱对比区域的两播放器也需要更新。需要把 `audio_url` 等信息包装成 `AudioPlayerProps`。

- [ ] **Step 1: 修改歌曲详情页**

找到第 135 行左右的：
```tsx
<AudioPlayer src={song.audio_url} className="w-full" />
```

替换为：
```tsx
<AudioPlayer
  src={song.audio_url}
  title={song.title}
  duration={song.duration}
  coverUrl={song.cover_url}
  songId={song.id}
  className="w-full"
/>
```

找到第 152 行左右的翻唱对比区域：
```tsx
<AudioPlayer src={(song.original_song as any)?.audio_url || ''} className="w-full" />
```
和：
```tsx
<AudioPlayer src={song.audio_url || ''} className="w-full" />
```

分别替换为：
```tsx
<AudioPlayer
  src={(song.original_song as any)?.audio_url || ''}
  title={(song.original_song as any)?.title || '原曲'}
  duration={(song.original_song as any)?.duration}
  coverUrl={(song.original_song as any)?.cover_url}
  songId={(song.original_song as any)?.id}
  className="w-full"
/>
```

和：
```tsx
<AudioPlayer
  src={song.audio_url || ''}
  title={song.title}
  duration={song.duration}
  coverUrl={song.cover_url}
  songId={song.id}
  className="w-full"
/>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/[id]/page.tsx
git commit -m "feat: integrate new AudioPlayer into song detail page"
```

---

## Task 13: 专辑详情页集成

**Files:**
- Modify: `apps/web/src/app/albums/[id]/page.tsx`

**说明:** 添加"播放专辑"按钮，点击后将专辑内所有歌曲写入全局播放列表并开始播放第一首。

- [ ] **Step 1: 修改专辑详情页**

在 imports 中添加：
```tsx
import { AudioPlayer, Button } from '@kiyo/ui'
import { Play } from 'lucide-react'
```

把 `AudioPlayer` 也导入进来用于页面内播放器展示（可选）。

在 `DraggableSongList` 上方添加一个播放区域。找到 `songs.length > 0` 条件，在其外部包裹一个播放器区域：

替换这一部分：
```tsx
      {songs.length > 0 ? (
        <DraggableSongList
          songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
          albumId={id}
        />
      ) : (
        <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
      )}
```

为：
```tsx
      {songs.length > 0 ? (
        <>
          <div className="mb-6">
            <AudioPlayer
              src={songs[0]?.audio_url || ''}
              title={songs[0]?.title}
              album={album.title}
              coverUrl={album.cover_url}
              songId={songs[0]?.id}
              playlist={songs.map((s: any) => ({
                id: s.id,
                title: s.title,
                audio_url: s.audio_url || '',
                cover_url: s.cover_url,
                duration: s.duration,
                album: album.title,
              }))}
              className="w-full"
            />
          </div>
          <DraggableSongList
            songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
            albumId={id}
          />
        </>
      ) : (
        <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
      )}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/albums/[id]/page.tsx
git commit -m "feat: integrate AudioPlayer with playlist into album detail page"
```

---

## Task 14: 类型检查与验证

**Files:**
- 无新文件，验证现有改动

- [ ] **Step 1: 对 packages/ui 运行类型检查**

```bash
cd packages/ui
pnpm type-check
```

Expected: 无类型错误。如果有错误，根据错误信息修复（常见：Howler 类型、Zustand 类型、missing dependency）。

- [ ] **Step 2: 对 apps/web 运行类型检查**

```bash
cd ../../apps/web
pnpm type-check
```

Expected: 无类型错误。

- [ ] **Step 3: 对整个 workspace 运行 lint**

```bash
cd ../..
pnpm lint
```

Expected: 无 lint 错误。如有自动修复：

```bash
pnpm lint -- --fix
```

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: resolve type-check and lint issues"
```

- [ ] **Step 5: 最终验证清单**

在浏览器中手动验证以下场景：

1. 打开任意歌曲详情页，点击播放按钮 → 底部出现迷你播放器，开始播放
2. 点击迷你播放器的暂停/播放 → 正常切换
3. 按空格键 → 播放/暂停切换
4. 按方向键 → 快进/快退/音量调节
5. 切换到其他页面（如专辑列表）→ 播放不中断
6. 打开专辑详情页 → 主播放器显示，点击播放从第一首开始
7. 专辑内播放时点击下一首 → 自动切换到专辑内下一首
8. 展开迷你播放器 → 显示播放队列，点击队列内歌曲可切换
9. 频谱可视化区域在播放时显示彩色柱状动画
10. 关闭迷你播放器（×）→ 播放停止，播放器消失

---

## Self-Review

### Spec Coverage Check

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 自定义播放器 UI | Task 5 (ProgressBar, PlayerControls, VolumeControl), Task 9 (AudioPlayer) |
| 键盘快捷键 | Task 3 (usePlayerKeyboard) |
| 播放列表模式 | Task 2 (Store 中的 playlist 逻辑), Task 7 (PlaylistPanel), Task 9 (AudioPlayer 传入 playlist) |
| 迷你播放器 | Task 8 (MiniPlayer) |
| 可视化效果 | Task 6 (SpectrumVisualizer) |
| 技术选型 Howler.js | Task 4 (AudioEngine) |
| 技术选型 Zustand | Task 2 (usePlayerStore) |
| 根布局集成 | Task 11 (GlobalPlayer + providers.tsx) |

✅ 所有 spec 需求都有对应 task。

### Placeholder Scan

- 无 "TBD"、"TODO"、"implement later"
- 每个 task 包含完整代码
- 每个 task 包含明确的 commit 命令
- 无 "Similar to Task N" 引用

### Type Consistency

- Store 中的 `PlayerSong` 接口在 Task 2 定义，被所有下游组件引用
- `RepeatMode` 类型在 Task 2 定义，Task 5 的 PlayerControls 正确使用
- `AudioPlayerProps` 在 Task 9 定义，与 Task 12/13 的调用匹配
- `analyserData` 类型 `Uint8Array | null` 在 Task 2 和 Task 4/6 中一致

✅ 类型一致，无冲突。
