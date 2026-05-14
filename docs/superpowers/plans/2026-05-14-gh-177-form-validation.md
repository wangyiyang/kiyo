# GitHub Issue #177 — 创建表单必填字段校验反馈缺失 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/songs/new` 和 `/lyrics/new` 的创建表单从手动 `useState` 重构为 `react-hook-form` + `zod` + `@kiyo/ui` Form 组件体系，实现字段级校验反馈、loading 状态和可访问性支持。

**Architecture:** 新增独立的 zod schema 文件和表单组件文件，与项目中 `auth/` 和 `lib/schemas/auth.ts` 的既有模式保持一致。两个 `page.tsx` 精简为仅负责页面布局和路由跳转，将表单逻辑下沉到独立组件中。

**Tech Stack:** Next.js 14, React, TypeScript, react-hook-form, zod, @hookform/resolvers, @kiyo/ui, vitest, @testing-library/react

---

## 文件结构

### 新增
- `apps/web/src/lib/schemas/songs.ts` — 歌曲创建 zod schema + 类型
- `apps/web/src/lib/schemas/lyrics.ts` — 歌词创建 zod schema + 类型
- `apps/web/src/components/songs/song-create-form.tsx` — 歌曲表单组件
- `apps/web/src/components/songs/song-create-form.test.tsx` — 歌曲表单测试
- `apps/web/src/components/lyrics/lyric-create-form.tsx` — 歌词表单组件
- `apps/web/src/components/lyrics/lyric-create-form.test.tsx` — 歌词表单测试

### 修改
- `apps/web/messages/zh.json` — 新增 `lyrics.new.error.emptyTitle` 和 `lyrics.new.error.emptyContent`
- `apps/web/messages/en.json` — 同上
- `apps/web/src/app/[locale]/songs/new/page.tsx` — 精简为布局 + 嵌入 SongCreateForm
- `apps/web/src/app/[locale]/lyrics/new/page.tsx` — 精简为布局 + 嵌入 LyricCreateForm

---

### Task 1: 新增歌词翻译 key（中英文）

`lyrics.new.error` 当前只有 `empty`（统一错误），字段级校验需要拆分。

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 zh.json**

找到 `lyrics.new.error`，将：
```json
"error": {
  "empty": "标题和内容不能为空"
}
```
替换为：
```json
"error": {
  "emptyTitle": "标题不能为空",
  "emptyContent": "内容不能为空"
}
```

- [ ] **Step 2: 修改 en.json**

找到 `lyrics.new.error`，将：
```json
"error": {
  "empty": "Title and content are required"
}
```
替换为：
```json
"error": {
  "emptyTitle": "Title is required",
  "emptyContent": "Content is required"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add field-level validation keys for lyric creation form"
```

---

### Task 2: 歌曲创建 Schema

**Files:**
- Create: `apps/web/src/lib/schemas/songs.ts`

- [ ] **Step 1: 创建 schema 文件**

```ts
import { z } from 'zod'

export const getSongCreateSchema = (t: (key: string) => string) =>
  z
    .object({
      title: z.string().min(1, t('error.emptyTitle')),
      prompt: z.string().min(1, t('error.emptyPrompt')),
      genre: z.string().optional(),
      mood: z.string().optional(),
      language: z.string().optional(),
      mode: z.enum(['instrumental', 'auto_lyrics', 'existing_lyric']),
      lyricId: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.mode === 'existing_lyric') {
          return !!data.lyricId?.trim()
        }
        return true
      },
      {
        message: t('error.noLyricSelected'),
        path: ['lyricId'],
      }
    )

export type SongCreateInput = z.infer<ReturnType<typeof getSongCreateSchema>>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/schemas/songs.ts
git commit -m "feat(schema): add song creation zod schema with conditional lyric validation"
```

---

### Task 3: 歌词创建 Schema

**Files:**
- Create: `apps/web/src/lib/schemas/lyrics.ts`

- [ ] **Step 1: 创建 schema 文件**

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

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/schemas/lyrics.ts
git commit -m "feat(schema): add lyric creation zod schema"
```

---

### Task 4: 歌曲创建表单组件（SongCreateForm）

**Files:**
- Create: `apps/web/src/components/songs/song-create-form.tsx`
- Create: `apps/web/src/components/songs/song-create-form.test.tsx`

先创建目录：

```bash
mkdir -p apps/web/src/components/songs
```

- [ ] **Step 1: 编写 SongCreateForm 组件**

```tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Wand2 } from 'lucide-react'

import {
  Button,
  Input,
  Textarea,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kiyo/ui'

import { getSongCreateSchema, type SongCreateInput } from '@/lib/schemas/songs'

interface SongCreateFormProps {
  lyrics: { id: string; title: string }[]
  onSuccess: (songId: string) => void
}

const LANGUAGE_OPTIONS = [
  { value: '', labelKey: 'languageUnlimited' },
  { value: 'zh', labelKey: 'zh' },
  { value: 'en', labelKey: 'en' },
  { value: 'ja', labelKey: 'ja' },
]

export function SongCreateForm({ lyrics, onSuccess }: SongCreateFormProps) {
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')
  const tLocale = useTranslations('localeSwitcher')

  const schema = React.useMemo(() => getSongCreateSchema((key) => t(key)), [t])

  const form = useForm<SongCreateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      prompt: '',
      genre: '',
      mood: '',
      language: '',
      mode: 'auto_lyrics',
      lyricId: '',
    },
    mode: 'onSubmit',
  })

  const mode = form.watch('mode')

  const modeOptions: {
    value: SongCreateInput['mode']
    labelKey: string
    descKey: string
    emoji: string
  }[] = [
    {
      value: 'instrumental',
      labelKey: 'mode.instrumental.label',
      descKey: 'mode.instrumental.desc',
      emoji: '🎵',
    },
    {
      value: 'auto_lyrics',
      labelKey: 'mode.auto_lyrics.label',
      descKey: 'mode.auto_lyrics.desc',
      emoji: '✍️',
    },
    {
      value: 'existing_lyric',
      labelKey: 'mode.existing_lyric.label',
      descKey: 'mode.existing_lyric.desc',
      emoji: '📝',
    },
  ]

  const handleGenerate = async (values: SongCreateInput) => {
    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          prompt: values.prompt.trim(),
          genre: values.genre || undefined,
          mood: values.mood || undefined,
          language: values.language || undefined,
          mode: values.mode,
          lyric_id:
            values.mode === 'existing_lyric' ? values.lyricId : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.song.id)
      } else {
        const errorMap: Record<string, string> = {
          UNAUTHORIZED: tCommon('errors.unauthorized'),
          VALIDATION_ERROR: tCommon('errors.validationError'),
        }
        form.setError('root', {
          message:
            errorMap[data.error?.code] ||
            data.error?.message ||
            tCommon('errors.unknown'),
        })
      }
    } catch {
      form.setError('root', { message: tCommon('errors.network') })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleGenerate)}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.title')} *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('placeholders.title')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.prompt')} *
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('placeholders.prompt')}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="genre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.genre')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.genre')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.mood')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.mood')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.language')}</FormLabel>
              <FormControl>
                <select
                  {...field}
                  className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === ''
                        ? t(opt.labelKey as any)
                        : tLocale(opt.labelKey as any)}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">
                {t('fields.mode')} *
              </FormLabel>
              <FormControl>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {modeOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                        field.value === opt.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value={opt.value}
                        checked={field.value === opt.value}
                        onChange={() => field.onChange(opt.value)}
                        className="sr-only"
                      />
                      <div className="text-lg">{opt.emoji}</div>
                      <div className="mt-1 font-medium">
                        {t(opt.labelKey as any)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t(opt.descKey as any)}
                      </div>
                    </label>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'existing_lyric' && (
          <FormField
            control={form.control}
            name="lyricId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('selectLyric')} *</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">{t('selectLyric')}</option>
                    {lyrics.map((lyric) => (
                      <option key={lyric.id} value={lyric.id}>
                        {lyric.title}
                      </option>
                    ))}
                  </select>
                </FormControl>
                {lyrics.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('noLyrics')}
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Wand2 className="mr-1 h-4 w-4" />
            {form.formState.isSubmitting
              ? tCommon('states.generating')
              : t('submit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Commit 组件**

```bash
git add apps/web/src/components/songs/song-create-form.tsx
git commit -m "feat(songs): add SongCreateForm with react-hook-form and zod validation"
```

---

### Task 5: SongCreateForm 单元测试

- [ ] **Step 1: 编写测试文件**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { SongCreateForm } from './song-create-form'
import { NextIntlClientProvider } from 'next-intl'
import zhMessages from '../../../messages/zh.json'

const mockLyrics = [
  { id: 'lyric-1', title: '歌词一' },
  { id: 'lyric-2', title: '歌词二' },
]

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('SongCreateForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders all fields', () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    expect(screen.getByLabelText(/歌曲名称/)).toBeInTheDocument()
    expect(screen.getByLabelText(/主题描述/)).toBeInTheDocument()
    expect(screen.getByLabelText(/风格/)).toBeInTheDocument()
    expect(screen.getByLabelText(/情绪/)).toBeInTheDocument()
    expect(screen.getByLabelText(/语言/)).toBeInTheDocument()
    expect(screen.getByText('开始创作')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText('歌曲名称不能为空')).toBeInTheDocument()
      expect(screen.getByText('主题描述不能为空')).toBeInTheDocument()
    })
  })

  it('shows conditional lyricId error when existing_lyric mode selected', async () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    // Select existing_lyric mode
    fireEvent.click(screen.getByText('已有歌词'))

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText('请选择关联歌词')).toBeInTheDocument()
    })
  })

  it('submits with correct payload when valid', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ song: { id: 'song-123' } }),
    })
    global.fetch = mockFetch

    const onSuccess = vi.fn()

    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={onSuccess} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/歌曲名称/), {
      target: { value: '测试歌曲' },
    })
    fireEvent.change(screen.getByLabelText(/主题描述/), {
      target: { value: '一首测试歌曲' },
    })

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/songs/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('测试歌曲'),
        })
      )
      expect(onSuccess).toHaveBeenCalledWith('song-123')
    })
  })

  it('shows server error on failed submission', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'VALIDATION_ERROR' } }),
    })
    global.fetch = mockFetch

    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/歌曲名称/), {
      target: { value: '测试歌曲' },
    })
    fireEvent.change(screen.getByLabelText(/主题描述/), {
      target: { value: '一首测试歌曲' },
    })

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText(/校验失败/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
cd apps/web && npx vitest run src/components/songs/song-create-form.test.tsx --reporter=verbose
```

Expected: 5 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/songs/song-create-form.test.tsx
git commit -m "test(songs): add SongCreateForm unit tests"
```

---

### Task 6: 歌词创建表单组件（LyricCreateForm）

**Files:**
- Create: `apps/web/src/components/lyrics/lyric-create-form.tsx`
- Create: `apps/web/src/components/lyrics/lyric-create-form.test.tsx`

先创建目录：

```bash
mkdir -p apps/web/src/components/lyrics
```

- [ ] **Step 1: 编写 LyricCreateForm 组件**

```tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Save } from 'lucide-react'

import {
  Button,
  Input,
  Textarea,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kiyo/ui'

import { getLyricCreateSchema, type LyricCreateInput } from '@/lib/schemas/lyrics'

interface LyricCreateFormProps {
  onSuccess: (lyricId: string) => void
}

export function LyricCreateForm({ onSuccess }: LyricCreateFormProps) {
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  const schema = React.useMemo(() => getLyricCreateSchema((key) => t(key)), [t])

  const form = useForm<LyricCreateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      content: '',
      language: '',
      style: '',
      mood: '',
    },
    mode: 'onSubmit',
  })

  const handleSave = async (values: LyricCreateInput) => {
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          content: values.content.trim(),
          language: values.language || undefined,
          style: values.style || undefined,
          mood: values.mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.lyric.id)
      } else {
        const errorMap: Record<string, string> = {
          UNAUTHORIZED: tCommon('errors.unauthorized'),
          VALIDATION_ERROR: tCommon('errors.validationError'),
        }
        form.setError('root', {
          message:
            errorMap[data.error?.code] ||
            tCommon('errors.createFailed'),
        })
      }
    } catch {
      form.setError('root', { message: tCommon('errors.network') })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSave)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.title')} *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('placeholders.title')}
                  maxLength={200}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.language')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.language')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="style"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.style')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.style')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.mood')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.mood')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.content')} *
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('placeholders.content')}
                  rows={12}
                  maxLength={10000}
                  className="font-mono text-sm leading-relaxed"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Save className="mr-1 h-4 w-4" />
            {form.formState.isSubmitting
              ? tCommon('states.saving')
              : tCommon('actions.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Commit 组件**

```bash
git add apps/web/src/components/lyrics/lyric-create-form.tsx
git commit -m "feat(lyrics): add LyricCreateForm with react-hook-form and zod validation"
```

---

### Task 7: LyricCreateForm 单元测试

- [ ] **Step 1: 编写测试文件**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { LyricCreateForm } from './lyric-create-form'
import { NextIntlClientProvider } from 'next-intl'
import zhMessages from '../../../messages/zh.json'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('LyricCreateForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders all fields', () => {
    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    expect(screen.getByLabelText(/标题/)).toBeInTheDocument()
    expect(screen.getByLabelText(/语言/)).toBeInTheDocument()
    expect(screen.getByLabelText(/风格/)).toBeInTheDocument()
    expect(screen.getByLabelText(/情绪/)).toBeInTheDocument()
    expect(screen.getByLabelText(/内容/)).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.getByText('标题不能为空')).toBeInTheDocument()
      expect(screen.getByText('内容不能为空')).toBeInTheDocument()
    })
  })

  it('submits with correct payload when valid', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lyric: { id: 'lyric-123' } }),
    })
    global.fetch = mockFetch

    const onSuccess = vi.fn()

    render(
      <Wrapper>
        <LyricCreateForm onSuccess={onSuccess} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/标题/), {
      target: { value: '测试歌词' },
    })
    fireEvent.change(screen.getByLabelText(/内容/), {
      target: { value: '这是歌词内容' },
    })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/lyrics',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('测试歌词'),
        })
      )
      expect(onSuccess).toHaveBeenCalledWith('lyric-123')
    })
  })

  it('shows server error on failed submission', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'UNAUTHORIZED' } }),
    })
    global.fetch = mockFetch

    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/标题/), {
      target: { value: '测试歌词' },
    })
    fireEvent.change(screen.getByLabelText(/内容/), {
      target: { value: '这是歌词内容' },
    })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.getByText(/未授权/)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
cd apps/web && npx vitest run src/components/lyrics/lyric-create-form.test.tsx --reporter=verbose
```

Expected: 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lyrics/lyric-create-form.test.tsx
git commit -m "test(lyrics): add LyricCreateForm unit tests"
```

---

### Task 8: 精简 songs/new/page.tsx

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/new/page.tsx`

- [ ] **Step 1: 重写 page.tsx**

替换整个文件为：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button } from '@kiyo/ui'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SongCreateForm } from '@/components/songs/song-create-form'

export default function NewSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <SongCreateForm
        lyrics={lyrics}
        onSuccess={(songId) => router.push(`/songs/${songId}`)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/new/page.tsx
git commit -m "refactor(songs): simplify new song page by extracting SongCreateForm"
```

---

### Task 9: 精简 lyrics/new/page.tsx

**Files:**
- Modify: `apps/web/src/app/[locale]/lyrics/new/page.tsx`

- [ ] **Step 1: 重写 page.tsx**

替换整个文件为：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button } from '@kiyo/ui'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LyricCreateForm } from '@/components/lyrics/lyric-create-form'

export default function NewLyricPage() {
  const router = useRouter()
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <LyricCreateForm
        onSuccess={(lyricId) => router.push(`/lyrics/${lyricId}`)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/lyrics/new/page.tsx
git commit -m "refactor(lyrics): simplify new lyric page by extracting LyricCreateForm"
```

---

### Task 10: 全局验证

- [ ] **Step 1: 类型检查**

```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-177-qa-medium && pnpm type-check
```

Expected: 0 errors

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: 0 errors

- [ ] **Step 3: 运行全部测试**

```bash
pnpm test
```

Expected: All tests pass (including new SongCreateForm and LyricCreateForm tests)

- [ ] **Step 4: 最终 Commit（如需要）**

如果 type-check 或 lint 需要修复，修复后 commit：

```bash
git add -A
git commit -m "fix: resolve type-check and lint issues for gh-177"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec 要求 | 对应任务 |
|-----------|----------|
| 歌曲创建必填字段校验 | Task 2 (schema) + Task 4 (组件) + Task 5 (测试) |
| 歌词创建必填字段校验 | Task 3 (schema) + Task 6 (组件) + Task 7 (测试) |
| 条件必填（existing_lyric 模式） | Task 2 (schema .refine) + Task 4 (条件渲染) + Task 5 (测试) |
| 字段级错误提示 | Task 4/6 中的 FormMessage |
| aria-invalid / aria-describedby | Task 4/6 中的 FormControl（@kiyo/ui 内置） |
| Label 错误高亮 | Task 4/6 中的 FormLabel（@kiyo/ui 内置） |
| 按钮 loading/disabled | Task 4/6 中的 `form.formState.isSubmitting` |
| 与项目现有模式一致 | 全部（react-hook-form + zod + @kiyo/ui Form） |
| 新增翻译 key | Task 1 |

### 2. Placeholder Scan

- ✅ 无 TBD / TODO
- ✅ 无 "implement later" / "fill in details"
- ✅ 无 "add appropriate error handling" 等模糊描述
- ✅ 每步都包含完整代码
- ✅ 无 "Similar to Task N" 引用

### 3. Type Consistency

- ✅ `SongCreateInput` 和 `LyricCreateInput` 在 schema 和组件中命名一致
- ✅ `getSongCreateSchema` / `getLyricCreateSchema` 接受 `(key) => t(key)` 模式一致
- ✅ 所有 `FormField` 的 `name` prop 与 schema key 对应
- ✅ `onSuccess` 回调签名在两个组件中一致：`(id: string) => void`

### 4. 无遗漏

- ✅ en.json 和 zh.json 都已标注修改
- ✅ 两个 page.tsx 都标注修改
- ✅ 测试覆盖所有验收标准中的场景
