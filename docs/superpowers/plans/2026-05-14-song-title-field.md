# 歌曲创建页增加「歌曲名称」字段实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 作曲创建页增加独立的「歌曲名称」必填字段，与「主题描述」分开；后端生成 API 接收并校验该字段。

**Architecture:** 前端 `songs/new` 页新增 `title` 输入框及校验逻辑，提交时携带 `title` 字段；后端 `/api/songs/generate` 读取 `title` 并做必填校验，`songs.insert` 直接使用用户输入的 `title` 替代原来的 `prompt` 截断值。翻译 key 复用已有文案。

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui (Input/Label), Vitest, Supabase

---

### Task 1: 后端 API — 接收并校验 title 参数

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/generate/route.test.ts`

- [ ] **Step 1: 修改 API 代码，增加 title 校验并使用 title 入库**

  在 `apps/web/src/app/api/songs/generate/route.ts` 中做三处改动：

  1. 解构 body 时加入 `title`：
  ```typescript
  const { prompt, mode, genre, mood, language, lyric_id, title } = body
  ```

  2. 在 prompt 校验之后、mode 校验之前，增加 title 校验：
  ```typescript
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }
  ```

  3. 修改 `songs.insert`，将 `title` 从 `prompt.trim().slice(0, 100)` 改为 `title.trim().slice(0, 100)`：
  ```typescript
  .insert({
    title: title.trim().slice(0, 100),
    lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
    genre: typeof genre === 'string' ? genre : null,
    mood: typeof mood === 'string' ? mood : null,
    ai_prompt: fullPrompt,
    status: 'generating',
    source: 'ai_generated',
    user_id: user.id,
  })
  ```

- [ ] **Step 2: 更新测试——所有 POST 请求补充 title 字段，并新增 title 缺失测试**

  在 `apps/web/src/app/api/songs/generate/route.test.ts` 中：

  1. 在 `createRequest` 调用中补充 `title: 'Test Song'`（共 7 处）。例如：
  ```typescript
  const response = await POST(createRequest({
    title: 'Test Song',
    prompt: 'A happy pop song',
    mode: 'auto_lyrics',
    genre: 'pop',
    mood: 'happy',
    language: 'en',
  }))
  ```

  2. 在 `describe` 块末尾新增一个测试用例：
  ```typescript
  it('missing title returns 400', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A happy pop song',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
  ```

- [ ] **Step 3: 运行 API 测试验证通过**

  ```bash
  pnpm --filter web test apps/web/src/app/api/songs/generate/route.test.ts
  ```

  Expected: 所有测试通过（包括新增的 missing title 测试）。

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/app/api/songs/generate/route.ts apps/web/src/app/api/songs/generate/route.test.ts
  git commit -m "feat(api): require title param in song generation endpoint (gh-180)"
  ```

---

### Task 2: 前端创建页 — 增加「歌曲名称」输入框

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/new/page.tsx`

- [ ] **Step 1: 新增 title state 和表单字段，更新提交逻辑**

  在 `apps/web/src/app/[locale]/songs/new/page.tsx` 中做以下改动：

  1. 在现有 state 声明处新增 `title`：
  ```typescript
  const [title, setTitle] = React.useState('')
  ```

  2. 在 prompt 输入框**上方**插入「歌曲名称」字段（放在 `mb-6 space-y-6` div 内的最前面）：
  ```tsx
  <div>
    <Label htmlFor="title">{t('fields.title')} *</Label>
    <Input
      id="title"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      placeholder={t('placeholders.title')}
    />
  </div>
  ```

  3. 在 `handleGenerate` 的 prompt 校验之后、mode 校验之前，增加 title 校验：
  ```typescript
  if (!title.trim()) {
    setError(t('error.emptyTitle'))
    return
  }
  ```

  4. 在 POST body 中增加 `title`：
  ```typescript
  body: JSON.stringify({
    title: title.trim(),
    prompt: prompt.trim(),
    genre: genre || undefined,
    mood: mood || undefined,
    language: language || undefined,
    mode,
    lyric_id: mode === 'existing_lyric' ? lyricId : undefined,
  }),
  ```

- [ ] **Step 2: 运行 TypeScript 类型检查**

  ```bash
  pnpm --filter web type-check
  ```

  Expected: 无类型错误。

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/app/[locale]/songs/new/page.tsx
  git commit -m "feat(ui): add separate song title field in creation form (gh-180)"
  ```

---

## Self-Review

### 1. Spec coverage

- ✅ 创建页增加「歌曲名称」必填字段 → Task 2
- ✅ 主题描述保持独立 → Task 2（prompt 字段不变）
- ✅ 后端接收并校验 title → Task 1
- ✅ title 入库替代 prompt 截断 → Task 1 Step 1
- ✅ 复用已有翻译 key → Task 2（使用 `t('fields.title')`、`t('placeholders.title')`、`t('error.emptyTitle')`）
- ✅ 测试覆盖 → Task 1 Step 2

### 2. Placeholder scan

无 TBD、TODO、"implement later"、"add appropriate validation" 等模糊表述。每个步骤都有确切的文件路径和代码。

### 3. Type consistency

- `title` 在前端是 `string`，在后端 body 解构时校验 `typeof title === 'string'`。
- 后端入库时 `title.trim().slice(0, 100)` 保持与原有 prompt 截断一致。
- 测试中的 `createRequest` body 类型为 `Record<string, unknown>`，新增 `title` 字段兼容。
