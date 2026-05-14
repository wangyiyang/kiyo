# 探索页无限滚动 + 服务端批量签名设计文档

> **Issue**: #139 — 探索页一次性渲染全部歌曲并触发大量签名请求  
> **目标**: 将探索页改为无限滚动分页，服务端批量签名封面 URL，消除首屏签名风暴。

---

## 背景

探索页 `/explore` 当前一次性加载所有 `is_public = true` 的歌曲（约 100 首），每个 `ShowcaseCard` 在客户端 `useEffect` 中单独请求 `/api/storage/sign` 获取封面签名 URL。这导致：

- 首屏 DOM 挂载大量卡片，移动端性能压力大
- 网络侧瞬间触发 100+ 签名请求，后端压力大
- 弱网环境下首屏体验差

2026-05-10 的 `explore-public-songs-design.md` 已规划分页，但实现时未落地。

---

## 方案选择

在 3 个方案中选择 **方案 A**：

| 方案 | 描述 | 结果 |
|------|------|------|
| A（推荐） | 新增公开分页 API + 客户端无限滚动 + 服务端批量签名 | ✅ 选中 |
| B | 全服务端分页 + "加载更多"链接跳转 | 体验不如无限滚动流畅 |
| C | 纯客户端 Supabase 查询 + 懒加载签名 | 无法批量签名，仍有零散请求 |

**选择理由**：无限滚动是用户明确要求的交互方式；服务端批量签名彻底解决签名风暴；与现有 `/api/songs` 分页模式一致。

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  /[locale]/explore/page.tsx (Server Component)          │
│  ├── 渲染页头 (SEO)                                      │
│  ├── 渲染筛选器 (genre/mood) — URL query 同步            │
│  └── <ExploreSongGrid genre={g} mood={m} />             │
│       (Client Component)                                 │
│       ├── useState: songs[], page, hasMore, isLoading   │
│       ├── IntersectionObserver → 触发 loadMore()        │
│       └── 渲染 ShowcaseCard 网格                         │
├─────────────────────────────────────────────────────────┤
│  GET /api/explore/songs?page=N&limit=18&genre=X&mood=Y  │
│  ├── 无需认证，公开访问                                    │
│  ├── 分页查询 is_public=true 的歌曲                       │
│  ├── 内存排序：有封面优先 → created_at 降序                │
│  ├── 批量签名 cover_file_path → cover_url                │
│  └── 返回 { songs, pagination: { page, limit, total,    │
│             hasMore } }                                  │
└─────────────────────────────────────────────────────────┘
```

---

## API 设计

### `GET /api/explore/songs`

**Query Parameters**:

| 参数 | 类型 | 默认值 | 限制 |
|------|------|--------|------|
| `page` | number | 1 | ≥1 |
| `limit` | number | 18 | 1–50 |
| `genre` | string | — | 精确匹配 |
| `mood` | string | — | 精确匹配 |

**实现逻辑**:

1. 解析并校验分页参数
2. 查询 `songs` 表：`is_public = true`，条件筛选 `genre`/`mood`，不带 `.range()` 获取全部符合条件的歌曲（当前公开歌曲约 100 首，完全在服务端内存可处理范围内）
3. 查询总数量（`count: 'exact'`），计算 `hasMore`
4. 内存排序：有封面（`cover_url || cover_file_path`）优先，再按 `created_at` 降序
5. 手动截取分页窗口：`sortedSongs.slice(from, to + 1)`
6. 批量签名：对当前页中 `cover_file_path` 存在但 `cover_url` 为空的歌曲，用 `createServiceRoleClient` 生成签名 URL，写入 `cover_url`
7. 返回 `{ songs, pagination }`

**返回格式**:

```json
{
  "songs": [
    {
      "id": "uuid",
      "title": "...",
      "genre": "...",
      "mood": "...",
      "cover_url": "https://signed-url/...",
      "cover_file_path": null,
      "audio_url": "...",
      "file_path": "...",
      "duration": 180
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 18,
    "total": 100,
    "hasMore": true
  }
}
```

**关于排序的权衡**：

"有封面优先"的排序无法在单个 Supabase query 中直接实现（需要跨字段逻辑）。当前公开歌曲约 100 首，服务端内存排序完全可接受。若未来增长到数千首，可改为：
- 添加 `has_cover` 计算列 + 数据库索引
- 或接受纯 `created_at` 降序

---

## 组件设计

### 新增：`ExploreSongGrid`（Client Component）

```tsx
// apps/web/src/components/explore-song-grid.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ShowcaseCard } from '@/components/sections/showcase-card'
import { EmptyState } from '@kiyo/ui'

interface Track { /* ... */ }
interface Pagination { page: number; limit: number; total: number; hasMore: boolean }

interface ExploreSongGridProps {
  genre?: string
  mood?: string
}
```

**状态**:
- `songs: Track[]` — 已加载的歌曲列表
- `page: number` — 下一页页码
- `hasMore: boolean` — 是否还有更多
- `isLoading: boolean` — 加载中
- `error: string | null` — 错误信息

**行为**:
1. **首次加载**：组件 mount 时触发 `loadMore()`（page=1）
2. **无限滚动**：`IntersectionObserver` 监听底部 sentinel，进入视口且 `!isLoading && hasMore` 时触发 `loadMore()`
3. **加载更多**：`fetch('/api/explore/songs?page=' + page + ...)`，`songs` 追加，`page++`
4. **筛选变化**：由于筛选器在 Server Component 用 `<Link>` 导航，Client Component 会 remount，自然触发重新加载

**底部状态**:
- `isLoading` → loading spinner
- `!hasMore && songs.length > 0` → "已显示全部歌曲"
- `!hasMore && songs.length === 0` → `EmptyState`
- `error` → 错误提示 + 重试按钮

### 改动：`ShowcaseCard`（最小改动）

修改签名逻辑：仅在 `cover_url` 为空时才请求 `/api/storage/sign`，避免 API 预签名后重复请求。

```tsx
useEffect(() => {
  if (track.cover_url) {
    setCoverUrl(track.cover_url)
    return
  }
  if (track.cover_file_path) {
    getSignedCoverUrl(track.cover_file_path).then((url) => {
      setCoverUrl(url || null)
    })
  }
}, [track.cover_url, track.cover_file_path])
```

### 改动：`explore/page.tsx`（Server Component）

保留内容：
- 页头（SEO `Metadata`）
- 筛选器（genre/mood 链接，URL query 同步）
- genre/mood 选项查询（用于筛选器渲染）

移除内容：
- 歌曲查询逻辑（移到 API）
- `ScrollReveal` 包裹每个卡片（无限滚动场景中逐元素动画会干扰性能，且加载更多时新元素动画体验不佳）
- 一次性渲染全部 `tracks.map()`

替换为：
- `<ExploreSongGrid genre={genre} mood={mood} />`

---

## 数据流

```
用户访问 /explore
  │
  ▼
Server Component 渲染页头 + 筛选器
  │
  ▼
ExploreSongGrid mount → loadMore(page=1)
  │
  ▼
GET /api/explore/songs?page=1
  │
  ├─ 分页查询 songs (is_public=true)
  ├─ 内存排序 (有封面优先)
  ├─ 批量签名 cover_file_path
  └─ 返回 { songs, pagination }
  │
  ▼
Client 渲染首屏 18 首卡片
  │
  ▼
用户向下滚动 → IntersectionObserver 触发
  │
  ▼
loadMore(page=2) → 追加歌曲，重复直到 hasMore=false
```

---

## 错误处理

| 场景 | 处理 |
|------|------|
| API 500 | Client 显示错误状态，提供"重试"按钮 |
| 网络中断 | `loadMore` catch 错误，停止 loading，显示重试 |
| 筛选无结果 | `songs.length === 0` 显示 `EmptyState` |
| 签名失败 | 降级显示渐变背景（ShowcaseCard 已有逻辑） |
| 后端 count 查询失败 | 保守返回 `hasMore: songs.length === limit` |

---

## 与现有系统的边界

- **不改动** `/api/songs`：该路由需认证，返回用户私有歌曲
- **不改动** 数据库 schema：现有 `is_public`、`cover_url`、`cover_file_path` 足够支撑
- **不新增** 通用 UI 组件：复用 `ShowcaseCard`、`EmptyState`
- **ShowcaseCard 向后兼容**：其他使用场景（首页 Showcase、专辑页等）不受影响

---

## 测试策略

| 类型 | 内容 |
|------|------|
| API 单元测试 | `GET /api/explore/songs` — 分页参数校验、genre/mood 筛选、匿名访问成功、批量签名写入 cover_url、空结果、越界 page |
| 组件测试 | `ExploreSongGrid` — 初始加载、滚动触发、筛选重置（remount）、hasMore 边界、错误重试 |
| E2E | Playwright：访问 `/explore`，滚动验证加载更多，切换筛选验证重置，验证网络面板中 `/api/storage/sign` 请求数量显著下降 |

---

## 验收标准

- [ ] 探索页首屏只加载 18 首歌曲
- [ ] 向下滚动自动加载下一页，直至全部加载完毕
- [ ] 筛选器切换后列表重置并重新加载
- [ ] 服务端批量签名后，首屏 `/api/storage/sign` 请求数量为 0
- [ ] 底部有明确的 loading / end 状态
- [ ] 移动端体验流畅，无卡顿
- [ ] 现有 ShowcaseCard、EmptyState 等组件无回归
