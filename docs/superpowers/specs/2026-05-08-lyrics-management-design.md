# Issue 9 + 10 合并设计：歌词管理与 AI 歌词生成

## 目的/结论

将 Issue 9（歌词管理 APIs 与编辑器）与 Issue 10（AI 歌词生成）合并为一次完整交付。实现歌词的创建、编辑、删除、AI 生成全流程，并提供一个可复用的结构化区块编辑器组件。

## 背景

- Issue 9 要求实现歌词的 CRUD 与前端编辑器，支持手动输入和 AI 生成两种来源。
- Issue 10 负责 MiniMax AI 歌词生成。
- 两个 Issue 在数据模型、API 链路、前端编辑流程上高度耦合，合并处理可减少重复设计和集成成本。
- 现有 `@kiyo/ai` 已封装 MiniMax 图片生成和文本生成，但缺少专用的歌词生成接口。
- 数据库 `lyrics` 表及 RLS 策略已就绪（`20260507120003_create_lyrics.sql`）。

## 方案或改动点

### 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         前端层                                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ /lyrics     │  │ /lyrics/:id  │  │ /lyrics/generate    │ │
│  │ 列表页       │  │ 详情页        │  │ AI 生成页            │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ /lyrics/[id]/edit                                       ││
│  │ 歌词编辑器（集成 StructuredBlockEditor）                  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                       │
│  POST   /api/lyrics                                           │
│  GET    /api/lyrics                                           │
│  GET    /api/lyrics/:id                                       │
│  PATCH  /api/lyrics/:id                                       │
│  DELETE /api/lyrics/:id                                       │
│  POST   /api/lyrics/generate    ──→  @kiyo/ai               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      数据层                                   │
│                    Supabase (lyrics 表)                       │
│                    Supabase Storage (预留)                    │
└─────────────────────────────────────────────────────────────┘
```

### 关键设计决策

1. **可复用编辑器定位**：`StructuredBlockEditor` 放在 `@kiyo/ui`，首次以歌词段落编辑为验证场景，接口保持通用（`Block { tag: string; content: string }`）。
2. **数据库存储**：`content` 始终保存原始文本（含 `[Verse]` 等标签），结构化解析只发生在前端展示/编辑层。
3. **AI 生成链路**：`apps/web` API Route → `@kiyo/ai` 新增 `generateLyrics()` → MiniMax `/v1/lyrics_generation`。
4. **状态管理**：列表页用 Server Components + Supabase server client；编辑器用 Client Component 本地状态，保存时调用 API。

### 数据模型

`lyrics` 表已由迁移文件 `20260507120003_create_lyrics.sql` 定义，无需变更：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | uuid PK | 歌词唯一标识 |
| `user_id` | uuid FK → auth.users | 所有者 |
| `title` | text | 歌词标题/歌曲名 |
| `content` | text | 歌词内容（含 `[Section]` 标签的纯文本） |
| `language` | text | 语言 |
| `style` | text | 风格 |
| `mood` | text | 情绪 |
| `source` | enum | `manual` / `ai_generated` |
| `ai_prompt` | text | AI 生成时使用的原始 prompt |
| `status` | enum | `draft` / `published` |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

### API 设计

```
POST   /api/lyrics              # 手动创建歌词
GET    /api/lyrics              # 获取当前用户歌词列表（按 created_at desc）
GET    /api/lyrics/:id          # 获取歌词详情
PATCH  /api/lyrics/:id          # 编辑歌词
DELETE /api/lyrics/:id          # 删除歌词
POST   /api/lyrics/generate     # AI 生成歌词
```

**`POST /api/lyrics/generate`**

请求体：
```json
{
  "prompt": "一首关于青春校园的励志歌曲",
  "language": "zh",
  "style": "流行",
  "mood": "励志"
}
```

后端处理：
1. 拼接完整 prompt（包含语言、风格、情绪约束）。
2. 调用 `@kiyo/ai` 的 `generateLyrics({ prompt })`。
3. MiniMax 返回带 `[Section]` 标签的文本。
4. 创建 `lyrics` 记录，`source='ai_generated'`，`status='draft'`。
   - `title` 取用户输入的 `prompt` 前 50 字作为初始标题（用户可在编辑器中修改）。
   - `ai_prompt` 保存用户输入的原始主题描述（即 `prompt` 字段），而非拼接后的完整 system prompt。
   - `language`、`style`、`mood` 分别保存用户表单值。
5. 返回 201 + 歌词详情。

响应：
```json
{
  "lyric": { "id": "...", "title": "...", "content": "...", "source": "ai_generated", ... }
}
```

### `@kiyo/ai` 扩展

新增 `packages/ai/src/lyrics.ts`：

```ts
export interface GenerateLyricsOptions {
  prompt: string
  mode?: 'write_full_song'
}

export interface GenerateLyricsResult {
  text: string
}

export async function generateLyrics(options: GenerateLyricsOptions): Promise<GenerateLyricsResult>
```

内部调用 `minimaxFetch('/v1/lyrics_generation', { mode, prompt })`。

### 前端组件与页面

#### `@kiyo/ui` 新增：`StructuredBlockEditor`

**设计目标**：通用结构化区块编辑器，首次用于歌词，接口不耦合歌词业务。

**数据接口**：
```ts
interface Block {
  id: string
  tag: string
  content: string
}
```

**Props**：
```ts
interface StructuredBlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  availableTags?: string[]
  readOnly?: boolean
}
```

**核心交互**：
1. **展示**：每个 block 为一个卡片，顶部 `tag` 输入框（支持下拉选择或自由输入），下方 `content` 多行文本框。
2. **增删**：每个 block 卡片右上角有删除按钮；底部有「添加区块」按钮。
3. **排序**：block 卡片左侧有上下箭头按钮调整顺序（首版用按钮，不引入拖拽库）。
4. **序列化**：组件外提供纯函数 `blocksToText(blocks): string` 和 `textToBlocks(text): Block[]`，负责 `[Section]` 标签 ↔ Block 数组的互转。

#### 页面路由

| 路由 | 类型 | 说明 |
|------|------|------|
| `/lyrics` | Server Component | 歌词列表页 |
| `/lyrics/[id]` | Server Component | 歌词详情页（只读） |
| `/lyrics/[id]/edit` | Client Component | 歌词编辑器页 |
| `/lyrics/generate` | Client Component | AI 歌词生成页 |

**`/lyrics` 列表页**：顶部「新建歌词」「AI 生成歌词」CTA；列表展示标题、来源标签、状态、创建时间；支持编辑、删除（二次确认）。

**`/lyrics/[id]/edit` 编辑页**：表单字段（标题、语言、风格、情绪）+ `StructuredBlockEditor` 核心编辑区；操作「保存」（PATCH → 列表页）、「取消」。

**`/lyrics/generate` AI 生成页**：表单（主题描述、语言下拉、风格输入、情绪输入）；提交后 loading，生成完成跳转编辑页；失败展示错误并允许重试。

### 错误处理

API Routes 统一复用 albums/songs 错误响应格式：
```json
{ "error": { "code": "UNAUTHORIZED|NOT_FOUND|VALIDATION_ERROR|FORBIDDEN|INTERNAL_ERROR|GENERATION_FAILED", "message": "..." } }
```

- **AI 生成失败**：MiniMax 超时/限流/审核拒绝时返回 `422 GENERATION_FAILED`，前端提示「生成失败，请修改描述后重试」。
- **歌词解析容错**：`textToBlocks()` 解析不规则内容时，未匹配到 `[Section]` 的文本统一放入 `tag="Text"` 的 block。
- **并发编辑**：暂不做乐观锁，以「后保存覆盖」为默认行为。

### 测试策略

| 层级 | 范围 | 方式 |
|------|------|------|
| 单元测试 | `@kiyo/ai` 的 `generateLyrics()` + `textToBlocks()`/`blocksToText()` | Vitest，mock `minimaxFetch` |
| API 测试 | `app/api/lyrics/**` 所有 Route Handlers | 复用现有 `route.test.ts` 模式，mock Supabase client |
| 组件测试 | `StructuredBlockEditor` 增删改排序交互 | Vitest + React Testing Library |
| E2E（可选） | 完整流程：生成 → 编辑 → 保存 → 列表查看 | Playwright，时间允许时补充 |

测试优先级：**单元测试 > API 测试 > 组件测试**。E2E 可延后。

## 影响与风险

1. **MiniMax API 稳定性**：歌词生成接口为在线服务，存在超时和限流风险。已通过 `@kiyo/ai` 的 retry 机制和前端重试按钮缓解。
2. **编辑器抽象过度**：`StructuredBlockEditor` 设计为通用组件，但当前仅歌词一个场景。已通过「首版不引入拖拽库、仅验证接口通用性」控制复杂度。
3. **数据格式兼容性**：`content` 纯文本存储保证了与现有 `lyrics` 表和 MiniMax API 输出的一致性，前端解析逻辑变更不影响存量数据。

## 验收标准

- [ ] 用户可手动创建歌词并保存为草稿
- [ ] 可编辑任意字段（标题、内容、语言、风格、情绪）
- [ ] AI 生成的歌词也可二次编辑
- [ ] 歌词列表支持按创建时间排序
- [ ] AI 歌词生成页支持配置语言、风格、情绪、主题描述
- [ ] 所有 API 附带单元测试，通过 `pnpm test`