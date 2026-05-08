# Issue 23: 扩展 songs 表并实现完整歌曲管理 — 设计文档

## 目的

当前 `songs` 表仅为最小结构（`id`, `user_id`, `title`, `created_at`, `updated_at`），无法支撑音乐生成、播放、歌词关联等核心业务。本设计扩展数据模型并完善前后端功能。

## 背景

- 项目已存在 `lyrics` 完整 CRUD 实现，可作为 songs 的对标模式
- `audio` Storage bucket 和 RLS 策略已就绪
- `album_songs` 关联表已存在，songs 表扩展不影响现有关联
- Minimax 音乐生成 API 支持通过 prompt + lyrics 生成音乐，返回音频 url（有效期 24h）

## 方案选择

采用**方案 A：两步式**

1. 创建歌曲占位（仅元数据，status = 'draft'）
2. 通过单独入口触发音乐生成（调用 Minimax API）

**原因**：与 lyrics 的"先创建 → 再生成"模式对齐，避免 HTTP 超时风险，职责清晰，支持重新生成。

## 数据库设计

### 迁移文件

`supabase/migrations/20260508120001_extend_songs.sql`

```sql
-- 扩展 songs 表字段
alter table songs add column audio_url text;
alter table songs add column cover_url text;
alter table songs add column lyric_id uuid references lyrics(id) on delete set null;
alter table songs add column status text not null default 'draft';
alter table songs add column duration int;
alter table songs add column genre text;
alter table songs add column mood text;
alter table songs add column source text not null default 'manual';
alter table songs add column ai_prompt text;

-- 添加检查约束
alter table songs add constraint songs_status_check
  check (status in ('draft', 'generating', 'completed', 'failed'));
alter table songs add constraint songs_source_check
  check (source in ('ai_generated', 'manual'));
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `audio_url` | text | 音频文件 URL（Supabase Storage） |
| `cover_url` | text | 歌曲封面 URL（预留） |
| `lyric_id` | uuid | 外键关联 `lyrics.id`，可选，on delete set null |
| `status` | text | `draft` / `generating` / `completed` / `failed` |
| `duration` | int | 音频时长（秒） |
| `genre` | text | 风格标签 |
| `mood` | text | 情绪标签 |
| `source` | text | `ai_generated` / `manual` |
| `ai_prompt` | text | AI 生成时的原始 prompt |

### RLS 与关联影响

- 沿用现有 `songs_user_all` 策略，无需新增
- `album_songs` 通过 `song_id` 外键关联，扩展字段无影响

## API 设计

### 歌曲 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/songs` | 创建歌曲占位 |
| GET | `/api/songs` | 列表（含歌词关联） |
| GET | `/api/songs/:id` | 详情（含歌词内容） |
| PATCH | `/api/songs/:id` | 更新元数据 |
| DELETE | `/api/songs/:id` | 删除歌曲 + 清理 Storage |

#### POST /api/songs

请求体：
```json
{
  "title": "string, required",
  "lyric_id": "string, optional",
  "genre": "string, optional",
  "mood": "string, optional",
  "ai_prompt": "string, optional"
}
```

响应：`{ song }`

#### GET /api/songs

使用 `.select('*, lyrics(title, id)')` 返回关联歌词标题。

响应：`{ songs: [...] }`

#### GET /api/songs/:id

使用 `.select('*, lyrics(*)')` 返回完整歌词内容。

响应：`{ song }`

#### PATCH /api/songs/:id

允许更新字段：`title`, `lyric_id`, `genre`, `mood`, `ai_prompt`, `cover_url`

**不允许**直接更新 `audio_url`, `status`, `duration`（由生成流程控制）。

响应：`{ song }`

#### DELETE /api/songs/:id

1. 删除 Storage 中 `audio/` bucket 下该歌曲的音频文件（如果存在）
2. 删除数据库记录

响应：`{ success: true }`

### 音乐生成

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/songs/:id/generate` | 触发音乐生成 |

#### 生成流程

1. 验证歌曲存在且属于当前用户
2. 验证 `lyric_id` 不为空
3. 更新 `status = 'generating'`
4. 调用 Minimax API (`POST /v1/music_generation`)：
   - `model`: `music-2.6`
   - `prompt`: `ai_prompt` + `genre` + `mood` 组合
   - `lyrics`: 关联歌词的 `content`
   - `output_format`: `url`
   - `audio_setting`: `{ format: 'mp3', sample_rate: 44100, bitrate: 256000 }`
5. 从返回 url 下载音频文件
6. 上传至 Supabase Storage：`audio/<user_id>/<song_id>/<timestamp>.mp3`
7. 更新 `audio_url`, `duration`（从 `extra_info.music_duration` 转换秒数）, `status = 'completed'`

#### 错误处理

- Minimax 调用失败或上传失败 → 更新 `status = 'failed'`
- 错误信息记录到应用日志

## 前端页面

### 歌曲列表页 `/songs`

- 网格卡片布局（参考 lyrics 列表页）
- 每张卡片展示：封面占位图、标题、时长、状态标签、关联歌词标题
- 状态标签样式：
  - `draft` — 灰色
  - `generating` — 蓝色 + 加载动画
  - `completed` — 绿色
  - `failed` — 红色
- 操作："生成音乐"（draft/failed）、"查看详情"
- 顶部"新建歌曲"按钮

### 歌曲详情页 `/songs/:id`

- 返回导航 + 编辑按钮
- 元数据：标题、风格、情绪、来源标签、AI prompt
- 状态指示器（大标签 + 进度说明）
- 音频播放器（`status === 'completed'` 时展示 `<audio>` 标签）
- 歌词区域（有关联歌词时展示，只读）
- 生成按钮（`draft` 或 `failed` 状态时展示）

### 新建歌曲页 `/songs/new`

- 表单：标题（必填）、风格、情绪、AI 生成描述（prompt）
- 歌词选择器：下拉选择当前用户的已有歌词（可选）
- 保存后跳转详情页

### 编辑歌曲页 `/songs/:id/edit`

- 与新建页类似的表单
- 支持修改标题、歌词关联、风格、情绪、AI prompt

## 数据流与状态流转

```
创建歌曲 ──► status: draft
    │
    ▼
点击"生成音乐"
    │
    ▼
PATCH status: generating ──► 调用 Minimax API
    │                              │
    │                    成功 ◄────┘
    │                              │
    ▼                              ▼
status: completed ◄──── 下载 + Storage 上传
    │
    ▼
展示音频播放器

失败路径：status: generating ──► Minimax/上传失败 ──► status: failed
    │
    ▼
可重新点击"生成音乐"回到 generating
```

## 组件设计

### 新增 UI 组件（`packages/ui`）

| 组件 | 说明 |
|------|------|
| `SongCard` | 歌曲卡片，展示封面、标题、时长、状态、关联歌词 |
| `AudioPlayer` | 轻量音频播放器，基于 `<audio>` 标签封装 |
| `SongStatusBadge` | 状态标签，带颜色和图标 |

### 修改现有组件

- `SongRow` — 当前仅展示标题，需扩展或标记为专辑专用

## 错误处理

| 场景 | 处理 |
|------|------|
| Minimax API 限流 (429) | 返回 422，前端提示"生成服务繁忙，请稍后重试" |
| Minimax API 超时 | 返回 500，更新 status = 'failed' |
| Storage 上传失败 | 更新 status = 'failed'，保留音频在临时 url（24h 内可重试） |
| 删除歌曲时 Storage 文件不存在 | 静默忽略，继续删除数据库记录 |

## 测试策略

| 测试类型 | 覆盖内容 |
|----------|----------|
| API 单元测试 | 每个 Route Handler 的 CRUD 操作、权限验证、字段校验 |
| 集成测试 | Minimax API 调用（mock）、Storage 上传/下载 |
| 前端组件测试 | SongCard、AudioPlayer 的渲染和交互 |

## 验收标准

- [ ] `songs` 表包含所有扩展字段，不影响现有 `album_songs` 关联
- [ ] 用户可以创建、查看、编辑、删除自己的歌曲
- [ ] 歌曲列表展示封面、时长、生成状态
- [ ] 歌曲详情页可播放音频（使用原生 `audio` 标签）
- [ ] 支持将已有歌词关联到歌曲（`lyric_id` 可选）
- [ ] 所有变更通过 Supabase 迁移文件管理
