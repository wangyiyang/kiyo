# Issue #26: Link lyrics to songs for creative workflow — Design

## Overview

在已有数据库外键 `songs.lyric_id` 和 API 全链路支持的基础上，补全前端层的用户体验：
- 歌词列表标识「已作曲」状态
- 歌词详情页支持一键生成关联音乐（弹窗面板）
- 歌词详情页展示已关联的歌曲列表

## Context

- 数据库：`songs.lyric_id` 外键 + RLS 已就绪
- API：`POST/GET/PATCH /api/songs`、`POST /api/songs/generate` 已支持 `lyric_id` 和 `existing_lyric` 模式
- AI 作曲页：`/songs/generate` 已支持下拉选择已有歌词
- 歌曲详情页：已展示关联歌词的完整内容

## Changes

### 1. 歌词列表页（`/lyrics/page.tsx`）

**数据层**
- 将查询从 `.select('*')` 改为 `.select('*, songs(count)')`
- Supabase 返回每首歌词的关联歌曲数量到 `songs` 字段（数组，取 `length` 或直接用 `count`）

**展示层**
- 歌词卡片标题右侧，条件渲染状态标签：
  - 若 `songs.length > 0`（或 `count > 0`）→ `<Badge variant="secondary">🎵 已作曲</Badge>`
  - 否则不显示标签

### 2. 歌词详情页（`/lyrics/[id]/page.tsx`）

#### 2.1 关联歌曲列表

**数据层**
- 在现有 `lyrics` 查询后追加：
  ```ts
  const { data: linkedSongs } = await supabase
    .from('songs')
    .select('id, title, status, genre, mood, created_at')
    .eq('lyric_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  ```

**展示层**
- 在 `StructuredBlockEditor` 下方新增 section：
  - 标题：「关联歌曲」
  - 空状态：「暂无关联歌曲。使用上方按钮生成音乐。」
  - 有数据：纵向迷你卡片列表，每项展示 `title` + `SongStatusBadge` + `genre/mood`，点击跳转 `/songs/{id}`

#### 2.2 生成音乐弹窗

**触发**
- 页面 header 中「编辑」按钮旁新增主按钮「🎵 生成音乐」
- 点击打开 `Dialog` 弹窗

**弹窗表单字段**
| 字段 | 类型 | 必填 | 默认值 |
|------|------|------|--------|
| 主题描述 | Textarea | 是 | 歌词标题 |
| 风格 | Input | 否 | 空 |
| 情绪 | Input | 否 | 空 |
| 语言 | select | 否 | 歌词 `language`（若存在） |
| 歌词预览 | 只读文本 | — | 歌词前 200 字 |

**提交行为**
- `POST /api/songs/generate`：
  ```json
  {
    "prompt": "主题描述",
    "mode": "existing_lyric",
    "lyric_id": "<当前歌词ID>",
    "genre": "...",
    "mood": "...",
    "language": "..."
  }
  ```
- 提交期间：按钮 disabled，显示「生成中...」
- 成功：`router.push(/songs/${song.id})`
- 失败：弹窗内展示 error message，不关闭弹窗

**前置校验**
- 若歌词 `content` 为空或空白：弹窗打开时检测，提示「歌词内容为空，无法生成音乐」，提交按钮 disabled

### 3. 错误处理

| 场景 | 行为 |
|------|------|
| 歌词内容为空 | 弹窗内提示，提交按钮 disabled |
| AI 生成失败（MinimaxError） | 弹窗内展示 API 错误信息，可重试 |
| 网络/未知错误 | 弹窗内提示「生成失败，请稍后重试」 |

## Files to Modify

- `apps/web/src/app/lyrics/page.tsx`
- `apps/web/src/app/lyrics/[id]/page.tsx`

## Acceptance Criteria

- [ ] 歌词列表页中，已关联歌曲的歌词显示「🎵 已作曲」标签
- [ ] 歌词详情页展示已关联的歌曲列表（含状态、风格、跳转）
- [ ] 歌词详情页点击「生成音乐」打开弹窗，表单默认填充歌词标题和语言
- [ ] 弹窗提交后调用现有 `/api/songs/generate`，成功跳转新歌曲详情页
- [ ] 歌词内容为空时，弹窗内提示并禁用提交
- [ ] 服务端已校验歌词归属（`lyric.user_id === currentUser.id`），无需新增校验逻辑

## Dependencies

- 复用现有：`/api/songs/generate`、`/api/songs`、Supabase RLS、Dialog/Textarea/Input/Button 组件
- 无新增 API 端点、无新增数据库迁移
