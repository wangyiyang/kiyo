# AI 翻唱（Voice Cover / Style Transfer）设计文档

## 目的

实现 AI 翻唱功能，用户可用指定的声音风格重新演绎已有歌曲或上传的音频，保留原曲情感。Issue #25。

## 背景

- 项目已有 AI 作曲功能（Issue #24），采用同步一站式生成流程
- `packages/ai` 已有 `generateMusic` 和 `minimaxFetch` 抽象
- Minimax 提供 `music-cover` 模型，支持基于参考音频的风格翻唱
- 歌曲表已有 `source`、`status`、`audio_url` 等字段

## 方案概述

采用**独立翻唱页 + 详情页跳转**方案：
- 新建 `/songs/cover` 页面作为翻唱主入口
- 支持两种参考音频来源：选择已有歌曲 / 本地上传音频
- 歌曲详情页增加「AI 翻唱」按钮，跳转预填参数
- 复用现有 AI 服务抽象层和 Storage 上传机制

## 架构

```
/songs/cover 前端页面
    │
    ├── 模式 A：选择已有歌曲（从歌曲库下拉选择）
    │   └── 自动带入 audio_url 和 title
    │
    └── 模式 B：上传音频（File Input → Supabase Storage）
        └── 获取 public URL
    │
    ▼
选择 voice_style（预设卡片）→ 可选输入标题
    │
    ▼
POST /api/songs/cover
    │
    ├── 校验参数
    ├── 创建 songs 记录（source='ai_cover', status='generating'）
    ├── 调用 @kiyo/ai generateCover()
    ├── 下载音频 → 上传 Storage
    ├── 更新 songs 记录（status='completed'）
    └── 返回 song 对象
    │
    ▼
跳转 /songs/{new_id}
```

## API 设计

### `POST /api/songs/cover`

**请求体**：

```typescript
{
  voice_style: string        // 目标翻唱风格，必填，长度 [10, 300]
  audio_url: string          // 参考音频 URL，必填
  original_song_id?: string  // 原歌曲 ID，选填（关联已有歌曲时传入）
  title?: string             // 翻唱作品标题，选填
}
```

**处理流程**：

1. 校验用户登录
2. 校验参数：`voice_style` 非空且长度在 [10, 300]；`audio_url` 为有效 URL
3. 若传了 `original_song_id`，校验该歌曲存在、归属当前用户、且有 `audio_url`
4. 插入新 `songs` 记录：
   - `title`: 用户输入 或 `"${原曲标题} 的翻唱"` 或 `"AI 翻唱作品"`
   - `source`: `'ai_cover'`
   - `status`: `'generating'`
   - `original_song_id`: 传入值或 `null`
   - `voice_style`: `voice_style`
   - `lyric_id`: 如 `original_song_id` 存在，复制原曲的 `lyric_id`
   - `user_id`: 当前用户
5. 调用 `generateCover({ voiceStyle, audioUrl })`
6. 下载翻唱音频 → 上传 Storage（`audio/{user_id}/{song_id}/{timestamp}.mp3`）
7. 更新 songs 记录：`audio_url`, `duration`, `status='completed'`
8. 返回 `{ song: Song }`

**错误处理**：

| 场景 | HTTP | 说明 |
|------|------|------|
| 参数校验失败 | 400 | `VALIDATION_ERROR` |
| 未登录 | 401 | `UNAUTHORIZED` |
| 原歌曲无 `audio_url` | 400 | `原歌曲没有可用音频` |
| 原歌曲权限不足 | 403 | `FORBIDDEN` |
| Minimax API 失败 | 422 | `GENERATION_FAILED`，同时更新 `status='failed'` |
| Storage 上传失败 | 500 | `INTERNAL_ERROR`，同时更新 `status='failed'` |

**响应**：

```typescript
// 成功
{ song: Song }

// 失败
{ error: { code: string, message: string } }
```

## AI 服务层改动（`packages/ai`）

### 新增 `src/cover.ts`

```typescript
import { minimaxFetch } from './client'
import { MinimaxError } from './errors'

export interface GenerateCoverOptions {
  voiceStyle: string
  audioUrl: string
}

export interface GenerateCoverResult {
  audioUrl: string
  duration: number
}

export async function generateCover(
  options: GenerateCoverOptions
): Promise<GenerateCoverResult> {
  const body = {
    model: 'music-cover',
    prompt: options.voiceStyle,
    audio_url: options.audioUrl,
    output_format: 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  }

  const response = await minimaxFetch('/v1/music_generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    data?: { audio?: string; status?: number }
    extra_info?: { music_duration?: number }
  }

  if (!data.data?.audio) {
    throw new MinimaxError('Invalid response from cover API', 'api_error')
  }

  const durationMs = data.extra_info?.music_duration ?? 0
  const durationSeconds = Math.round(durationMs / 1000)

  return {
    audioUrl: data.data.audio,
    duration: durationSeconds,
  }
}
```

### `src/index.ts` 导出更新

```typescript
export { generateCover } from './cover'
```

## 数据库

### 迁移文件

```sql
-- 添加 original_song_id 自引用外键
alter table songs add column original_song_id uuid references songs(id) on delete set null;

-- 添加 voice_style 字段记录翻唱风格
alter table songs add column voice_style text;

-- 扩展 source 约束，增加 ai_cover
alter table songs drop constraint songs_source_check;
alter table songs add constraint songs_source_check
  check (source in ('manual', 'ai_generated', 'ai_cover'));
```

### 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `original_song_id` | uuid | 引用原歌曲，翻唱作品专用 |
| `voice_style` | text | 翻唱时使用的风格描述 |

## 前端设计

### 页面：`/songs/cover`

**布局**：与现有 `/songs/generate` AI 作曲页保持一致的表单页风格。

**表单字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 参考音频来源 | Tabs | 是 | 「选择已有歌曲」/「上传音频」 |
| 已有歌曲 | Select | 条件 | 仅显示 `audio_url IS NOT NULL` 的歌曲 |
| 音频上传 | File Input | 条件 | mp3/wav/flac，最大 50MB |
| 翻唱风格 | 预设卡片网格 | 是 | 8 种风格，单选 |
| 作品标题 | Input | 否 | 默认自动填充 |

**预设风格卡片**（固定前端）：

| 图标 | 名称 | Prompt 文本 |
|------|------|-------------|
| 🎸 | 流行摇滚版 | `流行摇滚版，节奏更快，电吉他驱动` |
| 🎷 | 爵士钢琴版 | `爵士钢琴版，慵懒萨克斯，舒缓节奏` |
| 🎻 | 民谣吉他版 | `民谣吉他版，指弹吉他，亲密人声` |
| 🎹 | 电子舞曲版 | `电子舞曲版，强烈节拍，合成器铺底` |
| 🎺 | 古典管弦版 | `古典管弦版，弦乐编排，庄重氛围` |
| 🌙 | Lo-fi 放松版 | `Lo-fi 放松版，黑胶噪点，梦幻氛围` |
| 🤘 | 摇滚金属版 | `摇滚金属版，失真吉他，强力鼓组` |
| 🎤 | 灵魂乐版 | `灵魂乐版，情感充沛，即兴唱腔` |

**文件上传流程**：
1. 用户选择文件 → 前端通过 `@kiyo/supabase` client 直传 Storage
2. 上传路径：`audio-uploads/{user_id}/{timestamp}-{filename}`
3. 拿到 `publicUrl` 后填入表单，再随表单提交给 API

**状态流转**：

```
/songs/cover 表单页 → 点击「开始翻唱」→ loading → 跳转 /songs/{new_id}
                           ↓
                       失败 → Toast 错误 + 保留表单可重试
```

### 歌曲详情页 `/songs/[id]` 改动

- `status='completed' && audio_url` 时，在「编辑」按钮旁增加 **「AI 翻唱」按钮**
- 点击跳转 `/songs/cover?original_song_id={id}`
- 跳转后表单自动预填来源、歌曲、标题

### 翻唱结果详情页增强

当 `source='ai_cover' && original_song_id` 时：
- 显示来源标签 **「AI 翻唱」**（紫色系，区别于「AI 生成」「手动创建」）
- 显示翻唱风格：`voice_style`
- 增加 **「对比原曲」** 区域：并列两个 `AudioPlayer`，左侧原曲，右侧翻唱

## 数据流

```
用户输入 → 前端表单校验 → 上传音频（如需）→ POST /api/songs/cover
                                                          │
    ┌─────────────────────────────────────────────────────┘
    ▼
创建 songs 记录（generating, source='ai_cover'）
    │
    ▼
调用 Minimax /v1/music_generation (model='music-cover')
    │
    ▼
获取 audio_url → 下载音频 buffer
    │
    ▼
上传 Supabase Storage（audio/{user_id}/{song_id}/{timestamp}.mp3）
    │
    ▼
更新 songs 记录（completed, audio_url, duration）
    │
    ▼
返回 song 对象 → 前端跳转详情页
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 参考音频 URL 无效 | API 返回 400，不创建记录 |
| 原歌曲无 audio_url | API 返回 400 |
| 文件超过 50MB | 前端拦截 |
| Minimax API 失败 | 更新 status='failed'，返回 422 |
| Storage 上传失败 | 更新 status='failed'，返回 500 |
| 用户未登录 | 返回 401 |

## 测试策略

| 层级 | 覆盖点 |
|------|--------|
| 单元测试（`packages/ai`） | `generateCover` 参数构造、响应解析、错误处理 |
| API 测试（`apps/web`） | 成功路径、原歌曲权限校验、Minimax 失败回滚、参数校验 |
| 前端（可选） | 文件上传 → 提交 → 跳转详情页 |

## 验收标准

- [ ] 用户可对已有歌曲发起 AI 翻唱（详情页入口）
- [ ] 用户可上传本地音频文件进行 AI 翻唱（独立入口）
- [ ] 支持从 8 种预设风格中选择
- [ ] 翻唱作品作为新歌曲保存，`source='ai_cover'`
- [ ] 新歌曲关联原歌曲 `original_song_id`
- [ ] 翻唱结果支持在线预览播放
- [ ] 翻唱作品详情页支持对比原曲播放
- [ ] 翻唱失败时返回清晰错误，`status='failed'`，用户可重试

## 影响范围

| 文件/模块 | 改动类型 |
|-----------|---------|
| `packages/ai/src/cover.ts` | 新建 |
| `packages/ai/src/index.ts` | 增加导出 |
| `packages/ai/src/__tests__/cover.test.ts` | 新建 |
| `apps/web/src/app/api/songs/cover/route.ts` | 新建 |
| `apps/web/src/app/api/songs/cover/route.test.ts` | 新建 |
| `apps/web/src/app/songs/cover/page.tsx` | 新建 |
| `apps/web/src/app/songs/[id]/page.tsx` | 增加翻唱按钮、标签、对比播放器 |
| `supabase/migrations/` | 新增迁移 |
