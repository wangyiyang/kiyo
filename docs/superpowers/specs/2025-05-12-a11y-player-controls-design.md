# 设计：底部播放器可访问名称修复（#137）

## 背景

底部播放器的图标控制按钮缺少可访问名称（accessible name）。视觉用户可通过图标理解操作，但可访问性树中这些控件只暴露为无名称的 `button`。Issue #137 要求为所有播放器控件补齐 `aria-label`，并支持中英文语言切换。

## 目标

- 播放器所有交互按钮均有可访问名称。
- 播放/暂停等状态变化时名称同步变化。
- 中英文语言切换后 `aria-label` 文案随语言变化。

## 方案选型：Props 传入方案

采用 `@kiyo/ui` 组件接收可选 `labels` prop，由 `apps/web` 通过 `next-intl` 注入翻译。组件保留英文硬编码 fallback。

**理由：**
- 保持 `@kiyo/ui` 与 Next.js 特定 i18n 方案解耦，避免共享包被绑定到 `next-intl`。
- `AudioPlayer` 仅在 4 个页面使用，`MiniPlayer` 仅在 `GlobalPlayer` 中使用，调用点数量有限，修改成本可控。
- `aria-label` 的文案内容属于"产品文案"，由应用层管理符合职责分层。

## 架构

```
┌─────────────────────────────────────────────────────┐
│                    apps/web                          │
│  ┌─────────────────────────────────────────────┐    │
│  │  pages (songs/[id], albums/[id], ...)       │    │
│  │  ┌─────────────────────────────────────┐     │    │
│  │  │  useTranslations('player')          │     │    │
│  │  │  ↓                                  │     │    │
│  │  │  <AudioPlayer labels={...} />       │     │    │
│  │  │  <MiniPlayer labels={...} />        │     │    │
│  │  └─────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────┘    │
│                          ↓                           │
│              messages/zh.json, messages/en.json      │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                   @kiyo/ui                           │
│  ┌─────────────────────────────────────────────┐    │
│  │  PlayerControls, MiniPlayer, VolumeControl, │    │
│  │  AudioPlayer, PlaylistPanel, ProgressBar    │    │
│  │  ── each receives optional `labels` prop    │    │
│  │  ── falls back to hardcoded English         │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## 组件层改动

### PlayerControls

新增 `labels` prop：

```ts
interface PlayerLabels {
  shuffle?: string
  prev?: string
  next?: string
  play?: string
  pause?: string
  repeat?: string
  repeatOne?: string
}
```

每个 `<button>` 添加 `aria-label`，`play`/`pause` 按钮根据 `isPlaying` 状态动态选择对应 label。

### VolumeControl

新增 `labels`：

```ts
interface VolumeLabels {
  mute?: string
  unmute?: string
  volume?: string
}
```

静音按钮根据 `isMuted` 动态切换 `aria-label`。`<input type="range">` 的 `aria-label` 也使用 `labels.volume`。

### MiniPlayer

新增 `labels`：

```ts
interface MiniPlayerLabels {
  prev?: string
  next?: string
  play?: string
  pause?: string
  expand?: string
  collapse?: string
  close?: string
  cover?: string
}
```

- 封面 `<button>` 使用 `expand`/`collapse` 动态 label。
- 播放控制同 `PlayerControls`。
- 展开/收起按钮和关闭按钮各自使用对应 label。

### AudioPlayer

新增 `labels`：

```ts
interface AudioPlayerLabels {
  play?: string
  pause?: string
  playlist?: string
}
```

封面叠加的播放按钮和播放列表按钮各自使用对应 label。

### PlaylistPanel

新增 `labels`：

```ts
interface PlaylistLabels {
  empty?: string
  playingIndicator?: string
  playSong?: string  // 模板："播放 {title}"
}
```

- 播放列表项的 `<li>` 添加 `aria-label`，当前播放项标注为"正在播放 {title}"。
- 空列表文案通过 `labels.empty` 覆盖（可选）。

### ProgressBar

新增可选 `ariaLabel` prop，为可点击进度条提供可访问名称。默认 `"进度条"`。

## 翻译层改动

在 `messages/zh.json` 和 `messages/en.json` 中新增 `player` 命名空间：

**zh.json：**

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
  "playSong": "播放 {title}"
}
```

**en.json：**

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
  "playSong": "Play {title}"
}
```

## 调用层改动

### global-player.tsx

```tsx
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
```

### songs/[id]/page.tsx 等调用 AudioPlayer 的页面

```tsx
const t = useTranslations('player')

<AudioPlayer
  src={...}
  labels={{
    play: t('play'),
    pause: t('pause'),
    playlist: t('playlist'),
  }}
/>
```

## 动态状态同步

以下状态变化时，`aria-label` 必须同步更新：

| 状态 | 切换前 label | 切换后 label |
|------|-------------|-------------|
| isPlaying: false → true | 播放 → 暂停 |
| isMuted: false → true | 取消静音 → 静音 |
| isExpanded: false → true | 展开播放器 → 收起播放器 |
| repeatMode: off → all → one | 循环播放 → 单曲循环 |

组件内部通过条件表达式直接实现：

```tsx
aria-label={isPlaying ? labels.pause : labels.play}
```

## 文件清单

### 修改文件

| 文件 | 改动说明 |
|------|---------|
| `packages/ui/src/components/audio-player/PlayerControls.tsx` | 添加 `labels` prop 和 `aria-label` |
| `packages/ui/src/components/audio-player/VolumeControl.tsx` | 添加 `labels` prop 和 `aria-label` |
| `packages/ui/src/components/audio-player/MiniPlayer.tsx` | 添加 `labels` prop 和 `aria-label` |
| `packages/ui/src/components/audio-player/AudioPlayer.tsx` | 添加 `labels` prop 和 `aria-label` |
| `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | 添加 `labels` prop 和 `aria-label` |
| `packages/ui/src/components/audio-player/ProgressBar.tsx` | 添加 `ariaLabel` prop |
| `apps/web/messages/zh.json` | 新增 `player` 命名空间 |
| `apps/web/messages/en.json` | 新增 `player` 命名空间 |
| `apps/web/src/components/global-player.tsx` | 注入 `labels` |
| `apps/web/src/app/[locale]/songs/[id]/page.tsx` | 注入 `labels` |
| `apps/web/src/app/[locale]/songs/[id]/public/page.tsx` | 注入 `labels` |
| `apps/web/src/app/[locale]/albums/[id]/page.tsx` | 注入 `labels` |
| `apps/web/src/app/[locale]/albums/[id]/public/page.tsx` | 注入 `labels` |

### 无新增文件

## 验收标准

- [ ] 使用浏览器 DevTools Accessibility Tree 检查：播放器所有按钮均有非空 Accessible Name。
- [ ] 使用屏幕阅读器（或 Chrome 的 Live Regions）聚焦各按钮，确认播报正确的操作名称。
- [ ] 切换语言（zh → en）后，重新检查 Accessibility Tree，确认 `aria-label` 文案已变为英文。
- [ ] 点击播放/暂停、静音/取消静音、展开/收起，确认状态变化后 `aria-label` 同步切换。
- [ ] 播放列表中当前播放项的 `aria-label` 包含"正在播放"标识。
- [ ] `pnpm type-check` 无新增类型错误。
- [ ] `pnpm lint` 无新增 lint 错误。

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 调用点遗漏导致部分按钮无翻译 | 清单式枚举所有 `<AudioPlayer>` 和 `<MiniPlayer>` 调用点，逐页检查 |
| 新增 prop 导致现有调用方类型错误 | `labels` 设为可选（`?`），组件内部提供 fallback，保持向后兼容 |
| `messages` 存在合并冲突（当前有 `<<<<<<< HEAD` 标记） | 提交前先行修复 merge conflict，确保 JSON 有效 |

## 备注

- 当前 `messages/zh.json` 和 `messages/en.json` 顶部存在未解决的 Git merge conflict（`<<<<<<< HEAD`），实施前必须先修复。
- 本次改动不引入新的运行时依赖。
