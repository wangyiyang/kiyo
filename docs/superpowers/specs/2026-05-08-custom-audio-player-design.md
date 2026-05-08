# 自定义音频播放器体验 — 设计文档

**Issue:** #37  
**日期:** 2026-05-08  
**技术栈:** Howler.js + Zustand + Web Audio API + React / Next.js App Router

---

## 1. 概述

将项目中原生的 HTML5 `<audio controls>` 播放器替换为一个功能完整的自定义音频播放器系统，包含：

- 沉浸式深色主播放器 UI
- 底部常驻迷你播放器（页面切换不中断播放）
- 全局键盘快捷键
- 播放列表模式（专辑内连续播放）
- Canvas 频谱可视化效果

---

## 2. 需求回顾

Issue #37 全部 5 项子需求，一次性实现：

| # | 需求 | 优先级 |
|---|------|--------|
| 1 | 自定义播放器 UI（播放/暂停、进度条、音量、时间） | P1 |
| 2 | 键盘快捷键（空格暂停、方向键快进/快退等） | P1 |
| 3 | 播放列表模式（连续播放专辑歌曲） | P1 |
| 4 | 迷你播放器（页面切换继续播放） | P1 |
| 5 | 可视化效果（频谱/波形动画） | P1 |

---

## 3. 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 音频引擎 | Howler.js | 流式播放友好、跨浏览器抽象成熟、通过 `Howler.ctx` 可直接接入 Web Audio API |
| 全局状态 | Zustand | 轻量、无 Context re-render 问题、支持 devtools、Howler 实例通过 ref 外挂 |
| 可视化 | Web Audio API `AnalyserNode` | 原生能力、FFT 数据直接驱动 Canvas、无额外依赖 |
| 拖拽排序 | `@dnd-kit/core` + `@dnd-kit/sortable` | 项目若已用则复用，否则新增（轻量、无障碍友好） |

---

## 4. 状态架构（Zustand Store）

```ts
// packages/ui/src/store/usePlayerStore.ts

interface Song {
  id: string
  title: string
  album?: string
  artist?: string
  audio_url: string
  coverUrl?: string
  duration?: number
}

interface PlayerState {
  // 播放状态
  isPlaying: boolean
  currentTrack: Song | null
  currentTime: number      // 秒，精度 0.1
  duration: number         // 秒
  volume: number           // 0–1
  isMuted: boolean

  // 播放列表
  playlist: Song[]
  currentIndex: number
  repeatMode: 'off' | 'one' | 'all'
  isShuffle: boolean

  // 迷你播放器 UI
  isMiniPlayerVisible: boolean
  isMiniPlayerExpanded: boolean

  // 可视化数据
  analyserData: Uint8Array | null

  // Actions
  play: (song: Song, playlist?: Song[]) => void
  pause: () => void
  togglePlay: () => void
  seek: (time: number) => void
  next: () => void
  prev: () => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeatMode: () => void
  setMiniPlayerExpanded: (expanded: boolean) => void
  updatePlaylistOrder: (songs: Song[]) => void
}
```

**状态管理规则：**
- `currentTrack` 变化时，`AudioEngine` 卸载旧 Howl、创建新 Howl、自动播放
- `playlist` 为空时，`next()`/`prev()` 不操作
- `repeat: 'one'` → `onend` 自动重播当前曲
- `repeat: 'all'` + 列表末 → 回到第一首
- `isShuffle` → `next()` 从剩余歌曲中随机选择

---

## 5. 组件结构

```
packages/ui/src/
├── store/
│   └── usePlayerStore.ts
├── hooks/
│   └── usePlayerKeyboard.ts
└── components/audio-player/
    ├── index.ts                 # 统一导出
    ├── AudioEngine.tsx          # Howler 实例管理（无头组件）
    ├── AudioPlayer.tsx          # 主播放器（全页沉浸式）
    ├── MiniPlayer.tsx           # 底部迷你播放器
    ├── PlayerControls.tsx       # 播放/暂停/上一首/下一首按钮组
    ├── ProgressBar.tsx          # 进度条 + 当前/总时间
    ├── VolumeControl.tsx        # 音量滑块 + 静音切换
    ├── PlaylistPanel.tsx        # 播放列表面板（迷你播放器展开态）
    └── SpectrumVisualizer.tsx   # Canvas 频谱可视化
```

### 5.1 AudioEngine.tsx — Howler 桥接

```tsx
function AudioEngine() {
  const howlRef = useRef<Howl | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number>(0)

  const { currentTrack, isPlaying, volume, seekTo, setDuration, setCurrentTime, setAnalyserData } = usePlayerStore()

  useEffect(() => {
    if (!currentTrack?.audio_url) return
    howlRef.current?.unload()

    const howl = new Howl({
      src: [currentTrack.audio_url],
      html5: true,
      volume,
      onload: () => setDuration(howl.duration()),
      onend: () => { /* 按 repeat/shuffle 规则触发 next */ },
      onplay: () => {
        // 连接 AnalyserNode
        const ctx = Howler.ctx
        if (ctx) {
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          Howler.masterGain.connect(analyser)
          analyserRef.current = analyser
          // 启动 rAF 循环读取 FFT 数据
        }
      },
    })

    howlRef.current = howl
    if (isPlaying) howl.play()

    return () => { howl.unload(); cancelAnimationFrame(rafRef.current) }
  }, [currentTrack?.audio_url])

  useEffect(() => { /* 同步 isPlaying */ }, [isPlaying])
  useEffect(() => { /* 同步 volume */ }, [volume])
  useEffect(() => { /* 同步 seek */ }, [seekTo])

  // rAF 循环：每帧读取 analyser 数据 + 更新 currentTime
  useEffect(() => { /* ... */ }, [isPlaying])

  return null
}
```

**关键决策：**
- `html5: true` 启用流式播放（AI 生成的音频文件可能较大）
- Howler 实例通过 `useRef` 持有，不进入 Zustand state（不可序列化）
- `AnalyserNode` 连接到 `Howler.masterGain`，FFT 数据通过 rAF 循环写入 store
- `currentTime` 每 250ms 更新一次（或每帧通过 `howl.seek()` 读取），store 驱动 UI

### 5.2 AudioPlayer.tsx — 主播放器

深色沉浸式风格，用于歌曲详情页和专辑页：

- 顶部：歌曲封面（大）+ 标题 + 专辑名
- 中部：`SpectrumVisualizer`（可选展开/收起）
- 底部：`ProgressBar` + `PlayerControls` + `VolumeControl`
- 播放列表入口按钮（展开右侧或底部面板）

### 5.3 MiniPlayer.tsx — 迷你播放器

固定在页面底部（`position: fixed; bottom: 0;`），全站常驻：

**收起态：**
- 左侧：小封面 + 歌曲标题/专辑名（溢出省略）
- 中间：上一首 / 播放暂停 / 下一首
- 右侧：迷你进度条 + 音量图标 + 展开按钮

**展开态：**
- 收起态的所有内容
- 下方展开 `PlaylistPanel`，显示当前播放队列
- 队列内可点击切歌、拖拽排序

**行为规则：**
- 首次加载页面无播放时隐藏
- 开始播放后显示
- 提供 × 按钮：关闭后停止播放并隐藏
- 页面切换不中断（Howler 实例全局单例）

---

## 6. 键盘快捷键

```ts
// packages/ui/src/hooks/usePlayerKeyboard.ts

const SHORTCUTS: Record<string, () => void> = {
  ' ':          togglePlay,       // 空格
  'ArrowRight': () => seek(+5),   // 右箭头 快进 5s
  'ArrowLeft':  () => seek(-5),   // 左箭头 快退 5s
  'ArrowUp':    () => setVolume(min(1, volume + 0.1)),
  'ArrowDown':  () => setVolume(max(0, volume - 0.1)),
  'n':          next,
  'p':          prev,
  'm':          toggleMute,
}
```

**防冲突：** 焦点在 `<input>` / `<textarea>` / `[contenteditable]` 时不触发。

---

## 7. 频谱可视化

```tsx
// SpectrumVisualizer.tsx

const FFT_SIZE = 256        // 128 frequency bins
const BAR_COUNT = 48        // 分组为 48 根柱子
const SMOOTHING = 0.7       // 时间平滑系数
```

- 读取 `analyserData`（`Uint8Array`，值域 0–255）
- 将 128 bins 分组为 48 根柱子，每组取平均
- 高度映射：`value / 255 * canvasHeight`
- 颜色：CSS `linear-gradient(to top, #ec4899, #8b5cf6)`（粉→紫，与 shadcn 主题一致）
- 平滑：`currentHeight = SMOOTHING * prevHeight + (1 - SMOOTHING) * newHeight`
- 仅在主播放器可见或迷你播放器展开时渲染 rAF

---

## 8. 播放列表

- `PlaylistPanel` 接收 `playlist: Song[]` + `currentIndex`
- 使用 `@dnd-kit` 实现拖拽排序（若项目已有拖拽方案则复用）
- 排序后调用 `updatePlaylistOrder` 更新 store
- 点击歌曲直接切换播放（更新 `currentTrack` + `currentIndex`）
- 在歌曲详情页和专辑页的播放器中提供播放列表入口

---

## 9. 根布局集成

```tsx
// apps/web/src/app/layout.tsx

<body className="...">
  {children}
  <AudioEngine />
  <MiniPlayer />
  <KeyboardShortcuts />
</body>
```

**注意：** 由于 `AudioEngine` 和 `MiniPlayer` 都是 `'use client'` 组件，在 App Router 中需要通过 Client Component wrapper 引入，或直接在 `layout.tsx` 中导入（`layout.tsx` 本身可以是 Server Component，只要子组件标记 `'use client'` 即可）。

---

## 10. 文件变更清单

| 路径 | 操作 | 说明 |
|------|------|------|
| `packages/ui/src/components/audio-player.tsx` | 重写 | 完整主播放器 |
| `packages/ui/src/components/audio-player/AudioEngine.tsx` | 新建 | Howler 实例管理 |
| `packages/ui/src/components/audio-player/MiniPlayer.tsx` | 新建 | 底部迷你播放器 |
| `packages/ui/src/components/audio-player/PlayerControls.tsx` | 新建 | 控制按钮组 |
| `packages/ui/src/components/audio-player/ProgressBar.tsx` | 新建 | 进度条 + 时间 |
| `packages/ui/src/components/audio-player/VolumeControl.tsx` | 新建 | 音量控制 |
| `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | 新建 | 播放列表 |
| `packages/ui/src/components/audio-player/SpectrumVisualizer.tsx` | 新建 | Canvas 频谱 |
| `packages/ui/src/components/audio-player/index.ts` | 新建 | 统一导出 |
| `packages/ui/src/store/usePlayerStore.ts` | 新建 | Zustand store |
| `packages/ui/src/hooks/usePlayerKeyboard.ts` | 新建 | 快捷键 hook |
| `packages/ui/package.json` | 修改 | 添加 `howler`、`zustand` 依赖 |
| `packages/ui/src/index.ts` | 修改 | 导出新组件 |
| `apps/web/src/app/layout.tsx` | 修改 | 挂载 AudioEngine + MiniPlayer + KeyboardShortcuts |
| `apps/web/src/app/songs/[id]/page.tsx` | 修改 | 替换 AudioPlayer 为新版，点击播放写入 store |
| `apps/web/src/app/albums/[id]/page.tsx` | 修改 | 添加"播放专辑"按钮，将整个专辑歌曲写入 playlist |

---

## 11. 新增依赖

```json
{
  "howler": "^2.2.4",
  "zustand": "^4.5.0",
  "@types/howler": "^2.2.11"
}
```

---

## 12. 边界与错误处理

| 场景 | 处理 |
|------|------|
| 音频加载失败 | `onloaderror` 回调 → store 标记 `currentTrack = null`，显示 toast 提示 |
| 网络断开恢复 | Howler 自动重试，无需额外处理 |
| 用户快速切换歌曲 | `unload()` 旧实例后创建新实例，避免多音频同时播放 |
| 页面刷新 | 播放状态丢失（不持久化，符合 P2 体验优化定位） |
| 空播放列表 | `next()`/`prev()` 静默不操作，UI 按钮置灰 |

---

## 13. 性能考量

- `SpectrumVisualizer` 仅在可见时运行 rAF，组件 `unmount` 或收起时取消
- `AudioEngine` 的 `currentTime` 更新频率为 250ms（非每帧），减少 store 写入
- Zustand selector 订阅：各组件只订阅所需字段，避免不必要的 re-render
- Howler `html5: true` 避免将整个音频文件加载到内存
