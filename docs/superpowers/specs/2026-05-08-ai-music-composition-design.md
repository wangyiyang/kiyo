# AI 音乐作曲设计文档

## 目的

实现 Kiyo 核心能力——AI 作曲。用户输入主题、风格、情绪等参数，选择创作模式后，一键生成完整的人声+伴奏作品并自动保存到歌曲库。

## 背景

- Issue #24 要求实现 AI 音乐作曲功能
- 当前已有 `packages/ai` 的 `generateMusic` 函数和 `POST /api/songs/[id]/generate` 路由（为已有歌曲生成音乐）
- 需要新增「一站式 AI 作曲」能力：创建记录 + 调用 AI + 上传音频 + 更新状态，一步完成

## 方案概述

采用**方案一：渐进式生成（同步一站式）**

- 用户填写参数 → 点击生成 → API 同步调用 Minimax → 生成完成后自动跳转到歌曲详情页
- 符合 Issue 中「按同步方式设计」的要求
- Minimax Music 2.6 首包延迟已降至 20 秒以内，同步等待可接受

## 架构

```
/songs/generate 前端页面
    │
    ▼
POST /api/songs/generate
    │
    ├── 校验参数
    ├── 查询已有歌词（如需要）
    ├── 创建 songs 记录（status='generating'）
    ├── 调用 @kiyo/ai generateMusic()
    ├── 下载音频 → 上传 Supabase Storage
    ├── 更新 songs 记录（status='completed'）
    └── 返回 song 对象
```

## API 设计

### `POST /api/songs/generate`

**请求体**：

```typescript
{
  prompt: string           // 主题描述，必填
  genre?: string           // 风格，如"流行"
  mood?: string            // 情绪，如"欢快"
  language?: string        // 语言，如"zh"，作为 prompt 注入
  mode: 'instrumental' | 'auto_lyrics' | 'existing_lyric'
  lyric_id?: string        // mode='existing_lyric' 时必填
}
```

**处理流程**：

1. 校验参数（mode 合法性、lyric_id 必传性）
2. 若 `mode='existing_lyric'`，查询 lyrics 表校验 `user_id` 归属权
3. 构造完整 prompt：`theme + genre + mood + language`
   - language 映射：zh → 「中文」、en → 「英文」、ja → 「日文」，注入 prompt 开头
4. 插入 songs 记录：`status='generating'`, `source='ai_generated'`
5. 根据 mode 构造 `generateMusic` 参数：
   - `instrumental`: `{ prompt, isInstrumental: true }`
   - `auto_lyrics`: `{ prompt, lyricsOptimizer: true }`
   - `existing_lyric`: `{ prompt, lyrics: lyricContent }`
6. 调用 `generateMusic()` → 下载音频 → 上传 Storage `audio/` bucket
7. 更新 songs 记录：`audio_url`, `duration`, `status='completed'`
8. 返回完整 song 对象

**错误处理**：

- 任何失败都更新 `songs.status='failed'`
- Minimax 错误 → 返回 422，`{ error: { code: 'GENERATION_FAILED', message } }`
- 其他错误 → 返回 500，`{ error: { code: 'INTERNAL_ERROR', message } }`

**响应**：

```typescript
// 成功
{ song: Song }

// 失败
{ error: { code: string, message: string } }
```

## AI 服务层改动（`packages/ai`）

### `src/music.ts`

```typescript
export interface GenerateMusicOptions {
  prompt?: string
  lyrics?: string
  genre?: string
  mood?: string
  isInstrumental?: boolean
  lyricsOptimizer?: boolean  // 新增
}

export interface GenerateMusicResult {
  audioUrl: string
  duration: number
}
```

### 请求体构造

```typescript
const body: Record<string, unknown> = {
  model: 'music-2.6',
  output_format: 'url',
  audio_setting: {
    sample_rate: 44100,
    bitrate: 256000,
    format: 'mp3',
  },
}

// prompt 构造：theme + genre + mood + language
const parts: string[] = []
if (options.prompt) parts.push(options.prompt)
if (options.genre) parts.push(`风格：${options.genre}`)
if (options.mood) parts.push(`情绪：${options.mood}`)
const fullPrompt = parts.join('，')

if (fullPrompt) body.prompt = fullPrompt
if (options.lyrics) body.lyrics = options.lyrics
if (options.isInstrumental) body.is_instrumental = true
if (options.lyricsOptimizer) body.lyrics_optimizer = true  // 新增
```

### 参数校验矩阵（按 Minimax 文档）

| mode | prompt | lyrics | lyrics_optimizer | is_instrumental |
|------|--------|--------|-----------------|-----------------|
| instrumental | 必填 | 不传 | 不传 | true |
| auto_lyrics | 必填 | 不传 | true | false |
| existing_lyric | 可选 | 必填 | false | false |

## 数据库

**无需改动**。当前 `songs` 表已覆盖所有字段：

- `status`: 'draft' | 'generating' | 'completed' | 'failed'
- `source`: 'ai_generated' | 'manual'
- `audio_url`, `duration`, `genre`, `mood`, `ai_prompt`, `lyric_id`

## 前端设计

### 页面：`/songs/generate`

**表单字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 主题描述 | Textarea | 是 | 音乐主题，如"一首关于夏天的流行歌曲" |
| 风格 | Input | 否 | 如"流行"、"摇滚" |
| 情绪 | Input | 否 | 如"欢快"、"忧伤" |
| 语言 | Select | 否 | 中文/英文/日文，作为 prompt 注入 |
| 创作模式 | Radio Card | 是 | 三种模式选择 |
| 关联歌词 | Select | 条件 | mode='existing_lyric' 时显示 |

**三种创作模式**：

- 🎵 **纯音乐**：`is_instrumental: true`，无人声伴奏
- ✍️ **自动写词再作曲**：`lyrics_optimizer: true`，AI 自动写词后作曲
- 📝 **关联已有歌词**：选择已有 lyrics 记录，基于歌词作曲

**状态流转**：

```
表单页 → 点击「开始创作」→ 生成中页（loading） → 自动跳转 /songs/{id}
            ↓
        失败 → Toast 错误 + 重试按钮
```

**与现有页面关系**：

- `/songs` 列表页：「新建歌曲」旁增加「AI 作曲」入口按钮
- `/songs/[id]` 详情页：已支持播放器、重新生成，无需改动

## 数据流

```
用户输入 → 前端表单校验 → POST /api/songs/generate
                                              │
    ┌─────────────────────────────────────────┘
    ▼
创建 songs 记录（generating）
    │
    ▼
调用 Minimax /v1/music_generation
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
| Minimax API 失败 | `status='failed'`，返回 422，前端提示重试 |
| 歌词归属校验失败 | 返回 403 |
| Storage 上传失败 | `status='failed'`，返回 500 |
| 用户未登录 | 返回 401 |
| 参数校验失败 | 返回 400 |

## 测试策略

| 层级 | 覆盖点 |
|------|--------|
| 单元测试（`packages/ai`） | `generateMusic` 三种 mode 参数构造正确、`lyrics_optimizer` 透传 |
| API 测试（`apps/web`） | 成功路径、Minimax 失败回滚、歌词权限校验、参数校验 |
| E2E（可选） | 表单提交 → 生成中 → 跳转详情页 |

## 验收标准

- [ ] 输入主题和参数后，可生成符合要求的音乐作品
- [ ] 生成的音乐自动保存到歌曲库，`status='completed'`
- [ ] 原始 prompt 保存在 `ai_prompt` 字段
- [ ] 支持关联已有歌词进行生成
- [ ] 支持自动生成歌词后生成
- [ ] 支持纯音乐生成
- [ ] 生成失败时返回清晰错误，`status='failed'`，用户可重试
- [ ] 生成结果支持在线预览播放（复用现有详情页播放器）

## 影响范围

| 文件/模块 | 改动类型 |
|-----------|---------|
| `packages/ai/src/music.ts` | 新增 `lyricsOptimizer` 参数 |
| `apps/web/src/app/api/songs/generate/route.ts` | 新建 |
| `apps/web/src/app/songs/generate/page.tsx` | 新建 |
| `apps/web/src/app/songs/page.tsx` | 增加「AI 作曲」入口 |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | 无改动（复用逻辑） |
| `supabase-local/migrations/` | 无改动（表结构已覆盖） |
