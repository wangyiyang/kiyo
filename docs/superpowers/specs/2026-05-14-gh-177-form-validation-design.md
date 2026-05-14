# GitHub Issue #177 — 创建表单必填字段校验反馈缺失

## 问题概述

在 `/songs/new`（AI 作曲）和 `/lyrics/new`（新建歌词）两个创建入口中，当用户未填写必填字段直接点击提交时：
- 页面停留在原地，无任何反馈
- 没有字段级错误提示、高亮或聚焦引导
- 提交按钮无 loading / disabled 状态，用户无法判断操作是否生效

这是一个前端表单校验缺失问题，影响新用户首次创作体验。

## 目标

将两个创建表单从手动 `useState` 管理重构为项目标准的 `react-hook-form` + `zod` + `@kiyo/ui` Form 组件体系，实现：
1. 必填字段为空时阻止提交，并在对应字段附近展示明确错误提示
2. 错误提示可被键盘和屏幕阅读器感知（aria-invalid, aria-describedby）
3. 提交按钮有明确的 loading / disabled 状态
4. 与项目中现有 auth、feedback、settings 表单保持一致的实现模式

## 方案选择

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| A. 内联重构 | 直接在 page.tsx 中引入 useForm | 新增文件最少 | page 文件过长，无独立 schema，不便测试 | ❌ |
| **B. 独立组件 + schema** | 提取表单组件和 zod schema | 与项目现有模式一致，边界清晰，方便测试 | 新增 4 个文件 | **✅ 采用** |
| C. 通用 Hook | 抽象 useCreateForm 通用 hook | 复用度高 | 两页差异大（条件必填 vs 静态字段），强行统一会导致参数复杂 | ❌ |

## 文件结构

### 新增
```
apps/web/src/lib/schemas/songs.ts          # 歌曲创建 zod schema + 类型
apps/web/src/lib/schemas/lyrics.ts         # 歌词创建 zod schema + 类型
apps/web/src/components/songs/song-create-form.tsx    # 歌曲表单组件
apps/web/src/components/lyrics/lyric-create-form.tsx  # 歌词表单组件
```

### 修改
```
apps/web/src/app/[locale]/songs/new/page.tsx   # 精简为布局，嵌入 SongCreateForm
apps/web/src/app/[locale]/lyrics/new/page.tsx  # 精简为布局，嵌入 LyricCreateForm
```

## Schema 设计

### `apps/web/src/lib/schemas/songs.ts`

```ts
import { z } from 'zod'

export const getSongCreateSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('error.emptyTitle')),
    prompt: z.string().min(1, t('error.emptyPrompt')),
    genre: z.string().optional(),
    mood: z.string().optional(),
    language: z.string().optional(),
    mode: z.enum(['instrumental', 'auto_lyrics', 'existing_lyric']),
    lyricId: z.string().optional(),
  }).refine((data) => {
    if (data.mode === 'existing_lyric') {
      return !!data.lyricId?.trim()
    }
    return true
  }, {
    message: t('error.noLyricSelected'),
    path: ['lyricId'],
  })

export type SongCreateInput = z.infer<ReturnType<typeof getSongCreateSchema>>
```

**设计要点：**
- 接受 `t` 函数注入翻译，与 `lib/schemas/auth.ts` 保持一致的 i18n 模式
- `title` 和 `prompt` 为必填（`min(1)`）
- `genre`, `mood`, `language` 为可选
- `mode` 为枚举类型，默认 `'auto_lyrics'`
- 使用 `.refine()` 处理条件必填：当 `mode === 'existing_lyric'` 时，`lyricId` 必须非空

### `apps/web/src/lib/schemas/lyrics.ts`

```ts
import { z } from 'zod'

export const getLyricCreateSchema = (t: (key: string) => string) =>
  z.object({
    title: z.string().min(1, t('error.emptyTitle')),
    content: z.string().min(1, t('error.emptyContent')),
    language: z.string().optional(),
    style: z.string().optional(),
    mood: z.string().optional(),
  })

export type LyricCreateInput = z.infer<ReturnType<typeof getLyricCreateSchema>>
```

**设计要点：**
- `title` 和 `content` 为必填
- `language`, `style`, `mood` 为可选
- 保持与现有字段一致，不引入新的校验规则

## 组件设计

### `SongCreateForm`

**Props:**
```ts
interface SongCreateFormProps {
  lyrics: { id: string; title: string }[]  // 可选歌词列表
  onSuccess: (songId: string) => void       // 成功回调，由 page.tsx 传入 router.push
}
```

**内部逻辑：**
- 使用 `useForm<SongCreateInput>` + `zodResolver`
- `defaultValues` 包含所有字段默认值（`mode: 'auto_lyrics'`）
- `mode` 字段切换时，如从 `existing_lyric` 切走，清空 `lyricId`
- 提交前通过 `zodResolver` 自动校验，失败时字段级错误自动渲染
- 提交时设置 loading，按钮 disabled
- 服务端返回错误时，映射为翻译文案展示（通过 `form.setError('root', ...)` 或字段级 `setError`）
- 成功时调用 `onSuccess(data.song.id)`

**可访问性：**
- `FormControl` 自动注入 `aria-invalid` 和 `aria-describedby`
- `FormLabel` 在错误时自动变 `text-destructive`
- `FormMessage` 展示字段级错误，关联到 `formMessageId`

### `LyricCreateForm`

**Props:**
```ts
interface LyricCreateFormProps {
  onSuccess: (lyricId: string) => void
}
```

**内部逻辑：**
- 使用 `useForm<LyricCreateInput>` + `zodResolver`
- 结构与 `SongCreateForm` 一致，但字段更简单（无 mode 切换，无条件必填）
- 提交逻辑相同：POST `/api/lyrics`，成功回调 `onSuccess`

## 数据流

```
page.tsx
  ├─ 渲染页面布局（标题、返回链接）
  ├─ 获取 lyrics 列表（SongCreateForm 需要，仅 songs/new）
  └─ 渲染 <SongCreateForm lyrics={lyrics} onSuccess={handleSuccess} />

SongCreateForm
  ├─ useForm({ resolver: zodResolver(schema), defaultValues })
  ├─ 渲染 FormField（title, prompt, genre, mood, language, mode, lyricId）
  ├─ form.handleSubmit(handleGenerate)
  │   ├─ zod 校验失败 → 字段级 FormMessage 展示错误
  │   └─ zod 校验通过 → 异步提交
  │       ├─ POST /api/songs/generate
  │       ├─ loading = true，按钮 disabled
  │       ├─ 服务端错误 → 映射翻译，展示错误
  │       └─ 成功 → onSuccess(songId) → page.tsx router.push
```

## 页面级修改

### `songs/new/page.tsx`

精简后职责：
1. 获取 lyrics 列表（保留现有 fetch 逻辑）
2. 渲染页面布局（标题、返回链接）
3. 嵌入 `<SongCreateForm lyrics={lyrics} onSuccess={(id) => router.push(`/songs/${id}`)} />`

### `lyrics/new/page.tsx`

精简后职责：
1. 渲染页面布局
2. 嵌入 `<LyricCreateForm onSuccess={(id) => router.push(`/lyrics/${id}`)} />`

## 可访问性

- **字段级错误**：`FormControl` 自动注入 `aria-invalid={!!error}` 和 `aria-describedby`（指向描述文本和错误文本）
- **Label 高亮**：`FormLabel` 在 `error` 存在时自动应用 `text-destructive`
- **错误文本**：`FormMessage` 渲染为 `<p>` 元素，带 `id={formMessageId}`，可被屏幕阅读器朗读
- **按钮状态**：提交中 `disabled` + 加载文本，防止重复提交和焦点误操作
- **可选增强**：首次校验失败时，可将焦点移至第一个错误字段（通过 `form.setFocus`），但不在本次需求范围内

## 测试策略

为两个新组件各写一个 `.test.tsx`：

### `song-create-form.test.tsx`
- 渲染表单，验证所有字段存在
- 空表单提交，验证 `title` 和 `prompt` 字段出现错误提示
- 选择 `existing_lyric` 模式但不选歌词，验证 `lyricId` 出现条件必填错误
- 填充必填项后提交，验证 fetch 被正确调用且参数正确
- 服务端返回错误，验证错误提示展示
- 成功提交，验证 `onSuccess` 回调被调用

### `lyric-create-form.test.tsx`
- 渲染表单，验证所有字段存在
- 空表单提交，验证 `title` 和 `content` 字段出现错误提示
- 填充必填项后提交，验证 fetch 被正确调用
- 成功提交，验证 `onSuccess` 回调被调用

**测试环境**：项目已有的 vitest + @testing-library/react + jsdom

## 验收标准

- [ ] `/songs/new` 空主题（title 或 prompt）提交时，对应字段展示校验提示，阻止提交
- [ ] `/songs/new` 选择 `existing_lyric` 模式但未选歌词时，歌词字段展示校验提示
- [ ] `/lyrics/new` 空标题或内容提交时，对应字段展示校验提示，阻止提交
- [ ] 错误提示清晰、使用 `text-destructive` 样式，且可被屏幕阅读器感知
- [ ] 提交按钮在提交中有 loading / disabled 状态
- [ ] 所有新增代码通过 `pnpm type-check` 和 `pnpm lint`
- [ ] 新增表单组件有对应的单元测试，且通过 `pnpm test`
