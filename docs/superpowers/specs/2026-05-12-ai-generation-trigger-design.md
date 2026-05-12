# AI 生成触发统一入口设计

**Date**: 2026-05-12  
**Status**: Approved  
**Issue**: #132

## Overview

当前 `/songs/new` 页面仅创建 `status=draft`、`source=manual` 的草稿歌曲，既不触发 AI 音乐生成，也不扣减用户额度。而真正的 AI 生成入口是 `/songs/generate`，这导致用户混淆和预期不符。

本设计将 `/songs/new` 改造为唯一的 AI 作曲入口（触发 AI 生成 + 限流 + 额度扣减），废弃旧的草稿创建逻辑，并通过重定向确保现有链接兼容性。

## Problem Statement

1. `/songs/new` 语义暗示"创建新歌曲"，实际却只创建无音乐的草稿
2. `/songs/generate` 才是真正的 AI 作曲入口，但 URL 不够直观
3. 导航中存在两个并行的"创建"按钮（新建歌曲 vs AI 作曲），加剧困惑
4. 草稿创建功能在产品层面已确认不需要保留

## Design Decisions

- `/songs/new` → 唯一 AI 作曲入口，表单和功能复用原 `/songs/generate` 内容
- `/songs/generate` → 301 永久重定向到 `/songs/new`
- `POST /api/songs` → 移除草稿创建 handler
- `POST /api/songs/generate` → 完全保留，限流/任务/通知逻辑不变
- 导航入口合并为单一的"AI 作曲"按钮

---

## Page Layer

### `/songs/new` 页面改造

将现有草稿表单完全替换为 AI 生成表单：

| 改造项 | 旧内容 | 新内容 |
|--------|--------|--------|
| 页面标题 | "新建歌曲" | "AI 作曲" |
| 核心字段 | title, genre, mood, aiPrompt, lyric | prompt, genre, mood, language, 创作模式, lyric |
| 提交行为 | `POST /api/songs` 创建 draft | `POST /api/songs/generate` 触发 AI 生成 |
| 按钮文案 | "保存" | "开始创作" |
| 状态指示 | saving | generating |

**表单字段**：
- prompt（主题描述，必填）
- genre（风格，可选）
- mood（情绪，可选）
- language（语言，可选：不限/中文/English/日本語）
- mode（创作模式，单选）：
  - `instrumental` — 纯音乐
  - `auto_lyrics` — 自动写词
  - `existing_lyric` — 已有歌词
- lyric_id（选择已有歌词，仅 `existing_lyric` 模式时必填）

**提交成功后**：重定向到 `/songs/{song.id}`，歌曲状态为 `generating`。

### `/songs/generate` 页面处理

- 删除 `app/[locale]/songs/generate/page.tsx` 物理文件
- 在 `next.config.js` 中配置 301 重定向：`/songs/generate` → `/songs/new`

```js
// next.config.js
async redirects() {
  return [
    {
      source: '/songs/generate',
      destination: '/songs/new',
      permanent: true,
    },
  ]
}
```

---

## API Layer

### `POST /api/songs` — 废弃草稿创建

直接移除 `route.ts` 中的 `POST` handler。由于此前端点仅被 `/songs/new` 旧表单调用，没有其他消费者，移除后不会破坏其他功能。

### `POST /api/songs/generate` — 完全保留

以下逻辑**不做任何变更**：
- 限流检查（`checkRateLimit('song_generate', ...)`）
- 歌曲创建（`status='generating'`, `source='ai_generated'`）
- `generation_tasks` 记录创建
- 通知创建（`notification.generation.started`）
- 202 Accepted 响应

`/songs/new` 改造后的表单将直接提交到此端点。

---

## Navigation & Entry Points

### `/songs` 列表页

当前三个按钮：
- "AI 作曲" → `/songs/generate`
- "AI 翻唱" → `/songs/cover`
- "新建歌曲" → `/songs/new`

改造后：
- "AI 作曲" → `/songs/new`
- "AI 翻唱" → `/songs/cover`

移除"新建歌曲"按钮，避免与"AI 作曲"重复。

### Dashboard (`/dashboard`) 快速操作

当前：
- "新建歌曲" → `/songs/new`
- "AI 作曲" → `/songs/generate`

改造后：
- 合并为单个"AI 作曲" → `/songs/new`
- "AI 翻唱"保持不变

### 歌词详情页 (`/lyrics/[id]`)

"生成音乐"弹窗直接调用 `/api/songs/generate`，**无需变更**。

---

## i18n 文案调整

### `messages/zh.json` 变更

```json
{
  "songs": {
    "list": {
      "new": "AI 作曲",
      "generate": "AI 作曲",
      "cover": "AI 翻唱"
    },
    "new": {
      "title": "AI 作曲",
      "fields": {
        "prompt": "主题描述",
        "genre": "风格（可选）",
        "mood": "情绪（可选）",
        "language": "语言（可选）",
        "mode": "创作模式"
      },
      "placeholders": {
        "prompt": "描述你想要的音乐，如：一首关于夏天的流行歌曲"
      },
      "mode": {
        "instrumental": { "label": "纯音乐", "desc": "仅生成伴奏，无歌词" },
        "auto_lyrics": { "label": "自动写词", "desc": "AI 自动生成歌词并作曲" },
        "existing_lyric": { "label": "已有歌词", "desc": "使用已有歌词进行作曲" }
      },
      "languageUnlimited": "不限",
      "selectLyric": "请选择歌词",
      "noLyrics": "暂无可选歌词，请先创建歌词",
      "error": {
        "emptyPrompt": "主题描述不能为空",
        "noLyricSelected": "请选择关联歌词"
      },
      "submit": "开始创作"
    }
  }
}
```

### `messages/en.json` 变更

对应英文调整，结构同上。

### 废弃文案

`songs.generate` namespace 可暂时保留在 JSON 中（防止其他硬编码引用），但 `/songs/generate` 页面删除后不再有组件使用这些 key。清理工作可延后处理。

---

## Testing Strategy

### 需更新的测试

| 测试文件 | 变更 |
|---------|------|
| `app-route-structure.test.ts` | 从 `localizedRouteFiles` 中移除 `songs/generate/page.tsx`（通过 `next.config.js` 重定向，不再保留物理文件） |
| `api/songs/route.test.ts`（若有 POST 测试）| 移除 POST 相关用例 |
| `api/songs/generate/route.test.ts` | **无需变更** |

### 新增测试建议

- 验证 `next.config.js` 重定向配置是否返回 301
- 验证 `/songs/new` 页面表单提交后歌曲状态为 `generating`

---

## Data Migration & Compatibility

- **无 schema 变更**：不需要数据库 migration
- **历史数据保留**：已有 `status=draft`、`source=manual` 的歌曲保留不变
- **URL 兼容**：`/songs/generate` 通过 301 永久重定向自动跳转
- **外部链接**：用户书签、搜索引擎收录的 `/songs/generate` 链接会自动跳转

---

## Implementation Summary

| # | 任务 | 影响文件 |
|---|------|---------|
| 1 | 改造 `/songs/new/page.tsx` | `app/[locale]/songs/new/page.tsx` |
| 2 | 删除 `/songs/generate/page.tsx` | `app/[locale]/songs/generate/page.tsx` |
| 3 | 配置 next.config.js 重定向 | `next.config.js` |
| 4 | 移除 `POST /api/songs` handler | `app/api/songs/route.ts` |
| 5 | 更新 `/songs` 列表页按钮 | `app/[locale]/songs/page.tsx` |
| 6 | 更新 Dashboard 快速操作 | `app/[locale]/dashboard/page.tsx` |
| 7 | 更新 i18n 文案 | `messages/zh.json`, `messages/en.json` |
| 8 | 更新路由结构测试 | `i18n/app-route-structure.test.ts` |
| 9 | 清理 `/api/songs` POST 测试（若有）| `api/songs/route.test.ts` |

---

## Considerations

- `next.config.js` 的 `redirects` 在 `localePrefix: 'never'` 模式下需要确保不带 locale 前缀的源路径也能正确匹配
- 删除 `/songs/generate/page.tsx` 后，确保没有客户端代码通过 `<Link href="/songs/generate">` 直接导航（Next.js Link 仍可使用，因为重定向由服务端处理）
- `songs.generate` namespace 的 i18n key 短期内保留，防止遗漏的硬编码引用；确认清理完毕后可删除
