# 核心功能架构

本文档描述 Kiyo 的核心业务功能架构，包括数据模型、业务流程、API 设计和安全策略。

## 安全策略

### 速率限制（Rate Limiting）

为防止 AI 生成类 API 被恶意滥用，系统对所有昂贵的 AI 操作实施了滑动窗口速率限制。

**覆盖范围**：仅 AI 生成类端点（歌词生成、歌曲生成、翻唱、封面生成、任务重试），普通 CRUD 操作不限流。

**限流维度**：
- 已登录用户：`user:{user_id}`
- 未登录用户：`ip:{client_ip}`（从 `X-Forwarded-For` → `X-Real-IP` 提取）

**默认阈值**（每小时）：

| 动作 | 端点 | 限制 |
|------|------|------|
| 歌词生成 | `POST /api/lyrics/generate` | 10 次 |
| 歌曲生成 | `POST /api/songs/generate`, `POST /api/songs/:id/generate` | 5 次 |
| AI 翻唱 | `POST /api/songs/cover` | 5 次 |
| 封面生成 | `POST /api/songs/:id/cover?action=generate`, `POST /api/albums/:id/cover?action=generate` | 10 次 |
| 任务重试 | `POST /api/tasks/retry` | 10 次 |

**实现方式**：基于 Supabase PostgreSQL 的滑动窗口计数器，表为 `rate_limits`。详见设计文档 `docs/superpowers/specs/2026-05-11-rate-limiting-design.md`。

**429 响应示例**：
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Limit: 10 requests per hour. Please try again after 3600 seconds."
  }
}
```

响应头：`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`。

## 专辑管理（Album）

用户可从自己的歌曲库中选择歌曲创建专辑，并支持 AI 生成专辑封面。

### 数据模型

**`albums`** — 专辑主表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | 专辑唯一标识 |
| `user_id` | uuid FK → auth.users | 所有者，RLS 核心字段 |
| `title` | text | 专辑名称 |
| `description` | text | 专辑描述，可为空 |
| `cover_url` | text | 封面图片 URL（Supabase Storage），可为空 |
| `cover_status` | enum | `none` / `generating` / `completed` / `failed` |
| `status` | enum | `draft` / `published` |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

**`album_songs`** — 专辑与歌曲的关联表（多对多，支持一首歌属于多个专辑）

| 字段 | 类型 | 说明 |
|------|------|------|
| `album_id` | uuid FK → albums | 专辑 ID |
| `song_id` | uuid FK → songs | 歌曲 ID |
| `order_index` | int | 歌曲在专辑中的排序 |
| `created_at` | timestamptz | 添加时间 |
| PK | `(album_id, song_id)` | 复合主键 |

### RLS 策略

- `albums`：用户只能读写 `user_id = auth.uid()` 的行
- `album_songs`：通过 `album_id` 关联到 `albums.user_id` 进行权限校验
- 添加歌曲到专辑时，服务端必须校验 `songs.user_id = auth.uid()`，防止用户把别人的歌曲加入自己的专辑

### 创建专辑流程

1. 用户从歌曲库中选择歌曲（前端展示当前用户的 songs 列表）
2. 前端 `POST /api/albums` 请求体：`{ title, description?, song_ids[] }`
3. Server 校验所有 `song_ids` 属于当前用户
4. 事务中创建 `albums` 记录 + `album_songs` 关联记录（按 `song_ids` 顺序设置 `order_index`）
5. 返回专辑详情（含歌曲列表）

### API 设计

```
POST   /api/albums                # 创建专辑
GET    /api/albums                # 获取当前用户专辑列表
GET    /api/albums/:id            # 获取专辑详情（含歌曲列表）
PATCH  /api/albums/:id            # 更新专辑（标题、描述、歌曲顺序）
DELETE /api/albums/:id            # 删除专辑
POST   /api/albums/:id/generate-cover  # 生成专辑封面
```

## 专辑封面生成

### 流程

1. 用户调用 `POST /api/albums/:id/generate-cover`
2. Server 将 `albums.cover_status` 更新为 `generating`
3. 根据专辑信息构造 AI 图片生成 prompt（专辑标题 + 歌曲风格/情绪）
4. 调用 AI 图片生成服务生成封面
5. 生成完成后上传至 Supabase Storage `covers/` bucket
6. 更新 `albums.cover_url` 并将 `cover_status` 设为 `completed`
7. 失败时将 `cover_status` 设为 `failed`

### Storage 设计

- **Bucket**: `covers`
- **路径**: `<user_id>/<album_id>/<timestamp>.png`
- **RLS**: 公开读取（专辑封面是公开资源），仅所有者拥有上传/删除权限

### AI 服务

- **服务提供商**：Minimax（CN）
- **能力覆盖**：文生图（专辑封面）、大模型（歌词生成 prompt 优化、通用文本生成）
- **生成模式**：当前按同步方式设计（API 直接等待生成结果），若后续生成耗时过长，可改为异步队列模式
- **架构要求**：通过抽象层封装 Minimax API 调用，避免在业务代码中直接依赖具体 SDK

## 歌词管理（Lyrics）

支持 AI 生成歌词、手动创建歌词，以及对歌词进行编辑和二次创作。歌词可以独立存在，后续通过 `songs.lyric_id` 与歌曲关联。

### 数据模型

**`lyrics`** — 歌词主表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | 歌词唯一标识 |
| `user_id` | uuid FK → auth.users | 所有者，RLS 核心字段 |
| `title` | text | 歌词标题/歌曲名 |
| `content` | text | 歌词内容 |
| `language` | text | 语言（如 `zh`、`en`、`ja`） |
| `style` | text | 风格标签（流行、说唱、古风等） |
| `mood` | text | 情绪标签（欢快、忧伤、励志等） |
| `source` | enum | `ai_generated` / `manual` |
| `ai_prompt` | text | AI 生成时使用的原始 prompt，手动创建为空 |
| `status` | enum | `draft` / `published` |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### RLS 策略

- `lyrics`：用户只能读写 `user_id = auth.uid()` 的行
- 未来 `songs` 表关联歌词时，需确保用户只能使用自己的歌词（`songs.lyric_id` 对应的 `lyrics.user_id = auth.uid()`）

### AI 生成歌词流程

1. 用户在前端输入生成参数：`{ prompt, language?, style?, mood? }`
2. 前端 `POST /api/lyrics/generate`
3. Server 根据参数构造完整 AI prompt（如：「创作一首关于 XX 的粤语流行歌曲歌词，情绪忧伤」）
4. 调用 AI 歌词生成服务获取内容
5. 创建 `lyrics` 记录，`source='ai_generated'`，`status='draft'`，保存原始 prompt 到 `ai_prompt`
6. 返回歌词详情

### 手动创建/编辑歌词流程

- **创建**：`POST /api/lyrics` 请求体 `{ title, content, language?, style?, mood? }`，`source='manual'`
- **编辑**：`PATCH /api/lyrics/:id` 更新任意字段，包括 AI 生成后的二次修改
- **删除**：`DELETE /api/lyrics/:id`

### API 设计

```
POST   /api/lyrics/generate      # AI 生成歌词
POST   /api/lyrics               # 手动创建歌词
GET    /api/lyrics               # 获取当前用户歌词列表
GET    /api/lyrics/:id           # 获取歌词详情
PATCH  /api/lyrics/:id           # 编辑歌词
DELETE /api/lyrics/:id           # 删除歌词
```

### 与歌曲的关联

当前 lyrics 独立存在。后续 `songs` 表设计时，通过 `songs.lyric_id` 外键关联，支持两种创作路径：
- **先词后曲**：用户先创作/生成歌词，再基于歌词生成音乐
- **同步生成**：AI 生成音乐时自动创建对应的 lyrics 记录并关联

### AI 服务

- **服务提供商**：Minimax（CN）
- **能力覆盖**：大模型 API 用于歌词生成（通过 prompt 构造调用 Minimax 大模型）
- **架构要求**：歌词生成逻辑封装在 `packages/ai` 或 `apps/web/lib/ai` 中，统一调用 Minimax 大模型 API，不直接在组件层调用第三方 SDK
