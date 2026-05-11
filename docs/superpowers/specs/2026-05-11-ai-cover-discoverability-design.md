# AI 翻唱入口可发现性提升 — 设计文档

> Issue: [#51](https://github.com/wangyiyang/kiyo/issues/51)  
> 日期: 2026-05-11  
> 范围: 纯前端 UI 改动，无后端变更  

---

## 1. 问题与目标

AI 翻唱是 Kiyo 两大核心场景之一，但当前入口极深：
- 歌曲列表页没有任何翻唱相关按钮
- 只有进入歌曲详情页后，才能看到「AI 翻唱」按钮
- 用户上传本地音频翻唱的入口藏在 `/songs/cover` 页面，无导航直达

**目标**：在三个关键触点提升 AI 翻唱的可发现性和可触达性。

---

## 2. 方案总览

| 触点 | 改动 | 交互行为 |
|------|------|----------|
| 歌曲卡片（列表页） | 新增 🎤 翻唱快捷按钮 | hover 卡片时显示在右上角，点击跳转 `/songs/cover?original_song_id={id}` |
| 列表页顶部工具栏 | 新增「AI 翻唱」主按钮 | 点击跳转 `/songs/cover`，支持选择已有歌曲 / 上传本地音频 |
| 落地页 Features | 扩展为 4 张卡片，新增翻唱能力卡片 | 静态展示，点击后滚动或导航到 songs 页面 |

**关键设计决策**（已通过头脑风暴确认）：
- 卡片翻唱按钮位置：**右上角操作组**（与删除按钮并列，hover 时显示）
- 顶部翻唱按钮行为：**直接跳转到 `/songs/cover`**（复用现有页面）
- Features 呈现方式：**扩展为 4 张卡片**（新增独立翻唱能力卡片）

---

## 3. 改动范围

### 3.1 新增/修改文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/ui/src/components/song-card.tsx` | 修改 | 新增 `onCover` prop，hover 时显示翻唱按钮 |
| `apps/web/src/app/[locale]/songs/page.tsx` | 修改 | 顶部工具栏新增「AI 翻唱」按钮；给 SongCard 传入 `onCover` |
| `apps/web/src/components/sections/features.tsx` | 修改 | 扩展为 4 张卡片，新增 `aiCover` feature |
| `apps/web/messages/zh.json` | 修改 | 新增 `songs.list.cover`、`features.items.aiCover` 等 key |
| `apps/web/messages/en.json` | 修改 | 同上，英文翻译 |

### 3.2 无变更（复用已有能力）

- `/songs/cover` 页面 — 已支持 `?original_song_id=` 参数
- `/api/songs/cover` API — 已完整实现
- `generateCover()` 函数 — `@kiyo/ai` 中已封装
- 数据库 schema — 无变更

---

## 4. 组件设计

### 4.1 SongCard（packages/ui）

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
  onCover?: (id: string) => void  // 新增
}
```

**交互行为**：
- 卡片右上角操作组在 hover 时显示（与现有删除按钮行为一致）
- 翻唱按钮使用 `Mic2` lucide 图标，点击调用 `onCover(id)`
- 无 `onCover` prop 时不渲染翻唱按钮（向后兼容）
- 点击事件需阻止冒泡，避免同时触发卡片导航

### 4.2 SongsPage（列表页）

**顶部工具栏**：
```
[AI 作曲] [AI 翻唱] [新建]
```
- 「AI 翻唱」使用紫色主题色（与「AI 作曲」一致但图标不同 `Mic2`）
- 点击跳转 `/songs/cover`

**卡片区域**：
- 每个 `SongCard` 传入 `onCover` 回调
- 回调内执行：`router.push('/songs/cover?original_song_id=' + id)`

### 4.3 Features（落地页）

```tsx
const featureKeys = ['multiModel', 'controllable', 'endToEnd', 'aiCover'] as const

const featureIcons: Record<FeatureKey, LucideIcon> = {
  multiModel: Sparkles,
  controllable: Layers,
  endToEnd: Wand2,
  aiCover: Mic2,  // 新增
}
```

**布局**：4 张卡片响应式排列（`md:grid-cols-2 lg:grid-cols-4`），保持与现有设计风格一致。

---

## 5. 数据流

```
用户点击卡片翻唱按钮
    ↓
SongCard.onCover(id) — 阻止事件冒泡
    ↓
SongsPage → router.push(`/songs/cover?original_song_id=${id}`)
    ↓
CoverSongPage 读取 searchParams.get('original_song_id')
    ↓
自动选中该歌曲，用户配置风格后提交
    ↓
POST /api/songs/cover → 生成翻唱
    ↓
生成完成后 router.push(`/songs/${song.id}`)
```

---

## 6. 边界情况与错误处理

| 场景 | 行为 |
|------|------|
| 歌曲无音频 (`audio_url` 为 null) | 不显示翻唱按钮（与详情页现有逻辑一致） |
| 未登录用户 | 点击翻唱按钮后由 Next.js middleware 重定向到登录页 |
| 上传音频过大 (>50MB) | 保持现有 cover 页面校验逻辑 |
| 翻唱生成失败 | 保持现有 `/api/songs/cover` 错误处理（状态设为 `failed`） |
| 列表页空状态 | 顶部工具栏始终显示「AI 翻唱」，引导用户直接体验 |
| 移动端 | 操作组在 touch 设备上改为始终可见（而非 hover） |

---

## 7. i18n 新增文案

### zh.json

```json
{
  "songs": {
    "list": {
      "cover": "AI 翻唱"
    }
  },
  "features": {
    "items": {
      "aiCover": {
        "title": "AI 翻唱",
        "description": "一键改变风格——流行变爵士、摇滚变民谣，让同一首歌拥有无限可能。"
      }
    }
  }
}
```

### en.json

```json
{
  "songs": {
    "list": {
      "cover": "AI Cover"
    }
  },
  "features": {
    "items": {
      "aiCover": {
        "title": "AI Cover",
        "description": "Transform any song in one click — pop to jazz, rock to folk. Give your music infinite possibilities."
      }
    }
  }
}
```

---

## 8. 测试计划

| 测试项 | 类型 | 范围 |
|--------|------|------|
| SongCard 翻唱按钮渲染与点击 | 单元测试 | `packages/ui` — 验证 `onCover` prop 存在时渲染按钮，点击触发回调 |
| SongsPage 工具栏导航 | 单元测试 | `apps/web` — 验证「AI 翻唱」按钮导航到 `/songs/cover` |
| SongsPage 卡片翻唱回调 | 单元测试 | `apps/web` — 验证点击卡片翻唱按钮时传入正确 songId 并导航 |
| Features 4 卡片渲染 | 单元测试 | `apps/web` — 验证 `aiCover` 卡片正确渲染 |
| `?original_song_id` 预填充 | 集成测试 | 已有 cover 页面 — 验证 URL 参数正确解析 |
| i18n 文案完整性 | 类型检查 | `next-intl` 编译时验证 |
| 端到端：列表页 → 翻唱 → 生成 | E2E | Playwright — 完整用户流程 |

---

## 9. 实现要点

1. **SongCard 事件处理**：翻唱按钮的 onClick 必须 `e.preventDefault()` + `e.stopPropagation()`，避免同时触发卡片链接导航和删除按钮的意外行为。
2. **响应式网格**：Features 从 `md:grid-cols-3` 改为 `md:grid-cols-2 lg:grid-cols-4`，保持小屏幕 2 列、大屏幕 4 列。
3. **向后兼容**：`onCover` 为可选 prop，不影响任何不使用该 prop 的现有调用方。
4. **不改动后端**：所有翻唱生成逻辑复用现有 `/api/songs/cover` 和 `generateCover()`，无需新增 API。
