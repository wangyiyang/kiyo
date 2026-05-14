# Cover Generation 避免文字元素 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构封面生成的 Prompt 构造逻辑，在保留语义参考的前提下显式禁止文字生成，同步更新前后端及 Worker 代码。

**Architecture:** 将 `buildCoverPrompt` 从直接嵌入标题文本改为四层结构化 Prompt（语义描述 + 风格/情绪 + 格式约束 + 负面指令）。前后端共用同一函数，Worker 中维护同名副本。

**Tech Stack:** TypeScript, Vitest, Minimax `image-01`, Supabase Edge Functions (Deno)

---

## 文件结构

| 文件 | 动作 | 责任 |
|---|---|---|
| `apps/web/src/lib/cover.test.ts` | 创建 | `buildCoverPrompt` 独立单元测试（TDD） |
| `apps/web/src/lib/cover.ts` | 修改 | 重构 `buildCoverPrompt`，四层结构化输出 |
| `supabase-local/functions/process-generation-task/index.ts` | 修改 | 同步 `buildCoverPrompt` 实现 |
| `apps/web/src/app/api/albums/[id]/cover/route.test.ts` | 修改 | 添加 `task.payload.prompt` 断言 |
| `apps/web/src/app/api/songs/[id]/cover/route.test.ts` | 修改 | 添加 `task.payload.prompt` 断言 |

---

### Task 1: 编写 `buildCoverPrompt` 独立单元测试

**Files:**
- Create: `apps/web/src/lib/cover.test.ts`

**Context:** 当前没有针对 `buildCoverPrompt` 的独立测试。重构前先写测试锁定预期行为：
- album 和 song 两种类型均返回结构化 Prompt
- Prompt 中不出现 `"专辑:"`、`"歌曲:"` 这类诱导文字生成的直接嵌入
- Prompt 末尾固定包含负面指令
- 空 description / 空 genre+mood 时行为正确

- [ ] **Step 1: 创建测试文件**

```typescript
import { describe, it, expect } from 'vitest'
import { buildCoverPrompt } from './cover'

describe('buildCoverPrompt', () => {
  it('album: returns structured prompt without direct text embedding', () => {
    const prompt = buildCoverPrompt('album', {
      title: '夜曲',
      description: '一张关于夜晚与孤独的专辑',
    })
    expect(prompt).toContain('基于专辑主题"夜曲"的视觉封面设计')
    expect(prompt).toContain('关于夜晚与孤独的意境')
    expect(prompt).not.toContain('专辑:')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('album: handles missing description', () => {
    const prompt = buildCoverPrompt('album', {
      title: '无名',
    })
    expect(prompt).toContain('基于专辑主题"无名"的视觉封面设计')
    expect(prompt).toContain('正方形专辑封面，高细节，艺术插画风格')
    expect(prompt).not.toContain('undefined')
  })

  it('song: returns structured prompt with genre and mood', () => {
    const prompt = buildCoverPrompt('song', {
      title: '夏日微风',
      genre: '流行',
      mood: '轻松',
    })
    expect(prompt).toContain('基于歌曲主题"夏日微风"的视觉封面设计')
    expect(prompt).toContain('流行风格')
    expect(prompt).toContain('轻松情绪')
    expect(prompt).not.toContain('歌曲:')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('song: handles missing genre and mood', () => {
    const prompt = buildCoverPrompt('song', {
      title: '纯音乐',
    })
    expect(prompt).toContain('基于歌曲主题"纯音乐"的视觉封面设计')
    expect(prompt).not.toContain('风格')
    expect(prompt).not.toContain('情绪')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('always ends with negative instruction', () => {
    const albumPrompt = buildCoverPrompt('album', { title: 'A' })
    const songPrompt = buildCoverPrompt('song', { title: 'B' })
    const negative = '画面中不得出现任何文字、字母、数字、符号或语言字符'
    expect(albumPrompt.endsWith(negative)).toBe(true)
    expect(songPrompt.endsWith(negative)).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test -- --filter=web -- apps/web/src/lib/cover.test.ts
```

Expected: 5 个测试全部 FAIL，因为 `buildCoverPrompt` 旧实现不匹配断言。

- [ ] **Step 3: Commit 测试文件**

```bash
git add apps/web/src/lib/cover.test.ts
git commit -m "test(cover): add unit tests for buildCoverPrompt text avoidance"
```

---

### Task 2: 重构 `apps/web/src/lib/cover.ts`

**Files:**
- Modify: `apps/web/src/lib/cover.ts`

**Context:** 将 `buildCoverPrompt` 改为四层结构化输出，保留标题语义但不直接嵌入为文字指令。

- [ ] **Step 1: 替换 `buildCoverPrompt` 实现**

修改 `apps/web/src/lib/cover.ts`，将现有 `buildCoverPrompt` 函数替换为：

```typescript
const NEGATIVE_INSTRUCTION = '画面中不得出现任何文字、字母、数字、符号或语言字符'
const FORMAT_CONSTRAINT = '正方形专辑封面，高细节，艺术插画风格'

export function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  const entityLabel = type === 'album' ? '专辑' : '歌曲'
  const parts: string[] = [
    `基于${entityLabel}主题"${data.title}"的视觉封面设计`,
  ]

  if (type === 'album') {
    if (data.description) {
      parts.push(`${data.description}的${type === 'album' ? '意境' : '氛围'}`)
    }
  } else {
    const styleParts: string[] = []
    if (data.genre) styleParts.push(`${data.genre}风格`)
    if (data.mood) styleParts.push(`${data.mood}情绪`)
    if (styleParts.length > 0) {
      parts.push(styleParts.join('，'))
    }
  }

  parts.push(FORMAT_CONSTRAINT)
  parts.push(NEGATIVE_INSTRUCTION)

  return parts.join('。')
}
```

- [ ] **Step 2: 运行独立测试确认通过**

```bash
pnpm test -- --filter=web -- apps/web/src/lib/cover.test.ts
```

Expected: 5 个测试全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/cover.ts
git commit -m "feat(cover): refactor buildCoverPrompt with structured layers and text avoidance"
```

---

### Task 3: 同步 Worker 中的 `buildCoverPrompt`

**Files:**
- Modify: `supabase-local/functions/process-generation-task/index.ts`

**Context:** Worker 中有一份独立的 `buildCoverPrompt` 函数副本（Deno Edge Function），必须与前端库保持一致。

- [ ] **Step 1: 替换 Worker 中的 `buildCoverPrompt`**

在 `supabase-local/functions/process-generation-task/index.ts` 中，找到现有 `buildCoverPrompt` 函数定义并替换为：

```typescript
const NEGATIVE_INSTRUCTION = '画面中不得出现任何文字、字母、数字、符号或语言字符'
const FORMAT_CONSTRAINT = '正方形专辑封面，高细节，艺术插画风格'

function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  const entityLabel = type === 'album' ? '专辑' : '歌曲'
  const parts: string[] = [
    `基于${entityLabel}主题"${data.title}"的视觉封面设计`,
  ]

  if (type === 'album') {
    if (data.description) {
      parts.push(`${data.description}的${type === 'album' ? '意境' : '氛围'}`)
    }
  } else {
    const styleParts: string[] = []
    if (data.genre) styleParts.push(`${data.genre}风格`)
    if (data.mood) styleParts.push(`${data.mood}情绪`)
    if (styleParts.length > 0) {
      parts.push(styleParts.join('，'))
    }
  }

  parts.push(FORMAT_CONSTRAINT)
  parts.push(NEGATIVE_INSTRUCTION)

  return parts.join('。')
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase-local/functions/process-generation-task/index.ts
git commit -m "feat(worker): sync buildCoverPrompt with text avoidance logic"
```

---

### Task 4: 更新 Album Cover Route 测试

**Files:**
- Modify: `apps/web/src/app/api/albums/[id]/cover/route.test.ts`

**Context:** 在 "creates generation task and returns 202 for async generate" 测试中添加 `task.payload.prompt` 断言，确保端到端链路正确传递新 Prompt 结构。

- [ ] **Step 1: 添加 prompt 断言**

在 `apps/web/src/app/api/albums/[id]/cover/route.test.ts` 中，找到以下代码段（在 `// Verify generation task created` 注释之后）：

```typescript
    expect(mockClient.dataStore.generation_tasks).toHaveLength(1)
    const task = mockClient.dataStore.generation_tasks[0]
    expect(task.type).toBe('album_cover')
    expect(task.album_id).toBe('a1')
    expect(task.user_id).toBe('user-1')
    expect(task.payload.title).toBe('My Album')
```

在其后追加：

```typescript
    expect(task.payload.prompt).toContain('基于专辑主题"My Album"的视觉封面设计')
    expect(task.payload.prompt).toContain('关于夜晚与孤独的意境')
    expect(task.payload.prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
    expect(task.payload.prompt).not.toContain('专辑:')
```

- [ ] **Step 2: 运行 album route 测试确认通过**

```bash
pnpm test -- --filter=web -- apps/web/src/app/api/albums/\[id\]/cover/route.test.ts
```

Expected: 全部测试 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/albums/[id]/cover/route.test.ts
git commit -m "test(api): add prompt assertions for album cover generation"
```

---

### Task 5: 更新 Song Cover Route 测试

**Files:**
- Modify: `apps/web/src/app/api/songs/[id]/cover/route.test.ts`

**Context:** 在 "creates generation task and returns 202 for async generate" 测试中添加 `task.payload.prompt` 断言。

- [ ] **Step 1: 添加 prompt 断言**

在 `apps/web/src/app/api/songs/[id]/cover/route.test.ts` 中，找到以下代码段：

```typescript
    expect(mockClient.dataStore.generation_tasks).toHaveLength(1)
    const task = mockClient.dataStore.generation_tasks[0]
    expect(task.type).toBe('cover')
    expect(task.song_id).toBe('s1')
    expect(task.user_id).toBe('user-1')
    expect(task.payload.title).toBe('My Song')
    expect(task.payload.genre).toBe('Pop')
```

在其后追加：

```typescript
    expect(task.payload.prompt).toContain('基于歌曲主题"My Song"的视觉封面设计')
    expect(task.payload.prompt).toContain('Pop风格')
    expect(task.payload.prompt).toContain('Happy情绪')
    expect(task.payload.prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
    expect(task.payload.prompt).not.toContain('歌曲:')
```

- [ ] **Step 2: 运行 song route 测试确认通过**

```bash
pnpm test -- --filter=web -- apps/web/src/app/api/songs/\[id\]/cover/route.test.ts
```

Expected: 全部测试 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/[id]/cover/route.test.ts
git commit -m "test(api): add prompt assertions for song cover generation"
```

---

### Task 6: 全量验证

**Files:** N/A

- [ ] **Step 1: 运行 web app 全部测试**

```bash
pnpm test -- --filter=web
```

Expected: 所有现有测试 + 新 cover 测试通过。

- [ ] **Step 2: 运行类型检查**

```bash
pnpm type-check -- --filter=web
```

Expected: 无类型错误。

- [ ] **Step 3: 运行 lint**

```bash
pnpm lint -- --filter=web
```

Expected: 无 lint 错误。

- [ ] **Step 4: Commit（如有修复）**

如果 type-check 或 lint 发现问题并修复：

```bash
git add -A
git commit -m "fix: resolve type/lint issues after cover prompt refactor"
```

---

## Spec Coverage Check

| 设计文档要求 | 对应 Task |
|---|---|
| `buildCoverPrompt('album', {...})` 不含文字生成指令 | Task 1 (测试) + Task 2 (实现) |
| `buildCoverPrompt('song', {...})` 不含文字生成指令 | Task 1 (测试) + Task 2 (实现) |
| Prompt 末尾固定负面指令 | Task 1 (测试) + Task 2 (实现) |
| Worker 中函数与前端一致 | Task 3 |
| 相关单元测试通过 | Task 1-6 |
| TypeScript 编译通过 | Task 6 |

**Placeholder scan:** 无 TBD、TODO、"similar to" 等占位符。
**Type consistency:** `buildCoverPrompt` 签名在 Task 2 和 Task 3 中完全一致。
