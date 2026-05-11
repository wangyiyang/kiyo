# Waitlist 表单增强实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 扩展 Waitlist 表单字段（角色、功能偏好、使用场景），实现 Hero/底部 CTA 差异化交互路径。

**Architecture:** 将表单逻辑抽离为可复用的 `WaitlistForm` 组件，支持 `simple`（邮箱+角色）和 `full`（全部字段）两种模式。Hero 区域通过 `WaitlistDialog` 承载 simple 模式；底部区域使用新的 `InlineWaitlistForm` 直接内联渲染 full 模式。数据库新增 `role_new`/`interests`/`use_scenes` 三列，旧 `role` 列保留兼容。

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, react-hook-form, zod, next-intl, Supabase, Vitest

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `supabase-local/migrations/20260511000000_enrich_waitlist.sql` | 创建 | 数据库迁移：新增 role_new、interests、use_scenes 列 |
| `apps/web/src/lib/schemas/waitlist.ts` | 修改 | 更新 zod schema，新增 role/interests/useScenes 字段 |
| `apps/web/src/app/actions/waitlist.ts` | 修改 | Server action 写入新列 |
| `apps/web/src/app/actions/waitlist.test.ts` | 修改 | 更新测试：新字段写入断言 |
| `apps/web/src/components/waitlist-form.tsx` | 创建 | 核心表单组件，支持 simple/full 模式 |
| `apps/web/src/components/waitlist-form.test.tsx` | 创建 | 组件测试：两种模式渲染、多选交互 |
| `apps/web/src/components/waitlist-dialog.tsx` | 修改 | 重构为 Dialog 壳，内部渲染 WaitlistForm(simple) |
| `apps/web/src/components/inline-waitlist-form.tsx` | 创建 | 底部内联表单，默认折叠，展开后显示全部字段 |
| `apps/web/src/components/sections/final-cta.tsx` | 修改 | 替换 CTA 按钮为 InlineWaitlistForm |
| `apps/web/messages/zh.json` | 修改 | 新增 waitlist 相关 i18n 键值 |
| `apps/web/messages/en.json` | 修改 | 新增 waitlist 英文 i18n 键值 |

---

## Task 1: 数据库迁移

**Files:**
- Create: `supabase-local/migrations/20260511000000_enrich_waitlist.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- 扩展 Waitlist 表字段，支持用户画像收集
-- 旧 role 列保留兼容，新字段使用新列名

alter table public.waitlist
  add column role_new text,
  add column interests text[],
  add column use_scenes text[];

comment on column public.waitlist.role_new is '用户在音乐创作中的角色：beginner/enthusiast/indie/professional/songwriter/other';
comment on column public.waitlist.interests is '感兴趣的功能，多选：composition/arrangement/vocal/mixing/cover/lyrics';
comment on column public.waitlist.use_scenes is '使用场景，多选：personal/commercial/education/social';
```

- [ ] **Step 2: Commit**

```bash
git add supabase-local/migrations/20260511000000_enrich_waitlist.sql
git commit -m "feat(db): add role_new, interests, use_scenes to waitlist (#107)"
```

---

## Task 2: 更新前端 Schema

**Files:**
- Modify: `apps/web/src/lib/schemas/waitlist.ts`

- [ ] **Step 1: 替换整个文件内容**

```typescript
import { z } from 'zod'

export const roleOptions = [
  'beginner',
  'enthusiast',
  'indie',
  'professional',
  'songwriter',
  'other',
] as const

export const interestOptions = [
  'composition',
  'arrangement',
  'vocal',
  'mixing',
  'cover',
  'lyrics',
] as const

export const useSceneOptions = [
  'personal',
  'commercial',
  'education',
  'social',
] as const

// 单一真理来源：前端表单校验 + Server Action safeParse 共用
export const waitlistSchema = z.object({
  email: z
    .string()
    .min(1, '请输入邮箱')
    .email('请输入有效邮箱')
    .max(254, '邮箱过长'),
  role: z.enum(roleOptions).optional(),
  interests: z.array(z.enum(interestOptions)).max(6).optional(),
  useScenes: z.array(z.enum(useSceneOptions)).max(4).optional(),
})

export type WaitlistInput = z.infer<typeof waitlistSchema>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/schemas/waitlist.ts
git commit -m "feat(waitlist): extend schema with role, interests, useScenes (#107)"
```

---

## Task 3: 更新 Server Action

**Files:**
- Modify: `apps/web/src/app/actions/waitlist.ts`

- [ ] **Step 1: 替换整个文件内容**

```typescript
'use server'

import { headers } from 'next/headers'

import { captureAppException } from '@/lib/monitoring'
import { createServerClient } from '@kiyo/supabase/server'

import { waitlistSchema } from '@/lib/schemas/waitlist'

// discriminated union：调用方一处 switch 即可覆盖所有路径
export type WaitlistResult =
  | { ok: true }
  | { ok: false; code: 'INVALID' | 'DUPLICATE' | 'UNKNOWN'; message: string }

export async function joinWaitlist(input: unknown): Promise<WaitlistResult> {
  const parsed = waitlistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, code: 'INVALID', message: '邮箱格式不正确' }
  }

  const supabase = await createServerClient()
  const headerList = await headers()
  const userAgent = headerList.get('user-agent') ?? null

  const { error } = await supabase.from('waitlist').insert({
    email: parsed.data.email.trim().toLowerCase(),
    role_new: parsed.data.role ?? null,
    interests: parsed.data.interests ?? null,
    use_scenes: parsed.data.useScenes ?? null,
    source: 'landing',
    user_agent: userAgent,
  })

  if (error) {
    // 23505 = unique_violation，命中 waitlist_email_unique 约束
    if (error.code === '23505') {
      return {
        ok: false,
        code: 'DUPLICATE',
        message: '该邮箱已在 Waitlist 中，感谢支持',
      }
    }
    console.error('[waitlist] insert failed', error)
    captureAppException(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
    return { ok: false, code: 'UNKNOWN', message: '提交失败，请稍后再试' }
  }

  return { ok: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/actions/waitlist.ts
git commit -m "feat(waitlist): write new columns in server action (#107)"
```

---

## Task 4: 更新 Server Action 测试

**Files:**
- Modify: `apps/web/src/app/actions/waitlist.test.ts`

- [ ] **Step 1: 替换整个文件内容**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureAppException = vi.fn()
const insert = vi.fn()
const getHeader = vi.fn(() => 'Vitest')

vi.mock('@/lib/monitoring', () => ({
  captureAppException,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: getHeader,
  })),
}))

vi.mock('@kiyo/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert,
    })),
  })),
}))

describe('waitlist action', () => {
  beforeEach(() => {
    captureAppException.mockClear()
    insert.mockReset()
    getHeader.mockClear()
  })

  it('inserts with new columns', async () => {
    insert.mockReturnValue({ error: null })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'indie',
      interests: ['composition', 'cover'],
      useScenes: ['personal'],
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role_new: 'indie',
      interests: ['composition', 'cover'],
      use_scenes: ['personal'],
      source: 'landing',
      user_agent: 'Vitest',
    })
  })

  it('inserts with only email (optional fields omitted)', async () => {
    insert.mockReturnValue({ error: null })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'minimal@example.com',
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      email: 'minimal@example.com',
      role_new: null,
      interests: null,
      use_scenes: null,
      source: 'landing',
      user_agent: 'Vitest',
    })
  })

  it('captures insert failures', async () => {
    const error = { code: 'PGRST500', message: 'database unavailable' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'producer',
    })

    expect(result).toEqual({
      ok: false,
      code: 'UNKNOWN',
      message: '提交失败，请稍后再试',
    })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role_new: 'producer',
      interests: null,
      use_scenes: null,
      source: 'landing',
      user_agent: 'Vitest',
    })
    expect(captureAppException).toHaveBeenCalledWith(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
  })

  it('handles duplicate email', async () => {
    const error = { code: '23505', message: 'unique violation' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'dup@example.com',
    })

    expect(result).toEqual({
      ok: false,
      code: 'DUPLICATE',
      message: '该邮箱已在 Waitlist 中，感谢支持',
    })
  })
})
```

- [ ] **Step 2: 运行测试**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/apps/web && npx vitest run src/app/actions/waitlist.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/waitlist.test.ts
git commit -m "test(waitlist): update tests for new columns (#107)"
```

---

## Task 5: 创建核心表单组件 WaitlistForm

**Files:**
- Create: `apps/web/src/components/waitlist-form.tsx`
- Create: `apps/web/src/components/waitlist-form.test.tsx`

- [ ] **Step 1: 创建 WaitlistForm 组件**

```typescript
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronUp } from 'lucide-react'

import {
  Button,
  Checkbox,
  cn,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@kiyo/ui'

import { joinWaitlist } from '@/app/actions/waitlist'
import {
  waitlistSchema,
  roleOptions,
  interestOptions,
  useSceneOptions,
  type WaitlistInput,
} from '@/lib/schemas/waitlist'

export type WaitlistFormMode = 'simple' | 'full'

export interface WaitlistFormProps {
  mode: WaitlistFormMode
  /** 内联模式时显示折叠/展开控制 */
  collapsible?: boolean
  onSuccess?: () => void
}

export function WaitlistForm({ mode, collapsible, onSuccess }: WaitlistFormProps) {
  const [pending, startTransition] = React.useTransition()
  const [expanded, setExpanded] = React.useState(!collapsible)
  const t = useTranslations('waitlist')

  const form = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      email: '',
      role: undefined,
      interests: [],
      useScenes: [],
    },
    mode: 'onSubmit',
  })

  const onSubmit = (values: WaitlistInput) => {
    startTransition(async () => {
      const result = await joinWaitlist(values)
      if (result.ok) {
        toast.success(t('toast.success.title'), {
          description: t('toast.success.description'),
        })
        form.reset()
        onSuccess?.()
        return
      }

      const description =
        result.code === 'DUPLICATE'
          ? t('toast.duplicate')
          : result.code === 'INVALID'
            ? t('toast.invalid')
            : t('toast.unknown')

      toast.error(result.message, { description })
    })
  }

  const toggleExpanded = () => setExpanded((v) => !v)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('fields.email.placeholder')}
                  autoComplete="email"
                  autoFocus={mode === 'simple'}
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* simple 模式下直接显示角色；full 模式下折叠后隐藏扩展字段 */}
        {mode === 'simple' && (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.role.label')}</FormLabel>
                <FormControl>
                  <RoleGrid
                    value={field.value}
                    onChange={field.onChange}
                    disabled={pending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {mode === 'full' && collapsible && !expanded && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleExpanded}
            className="w-full"
          >
            <ChevronDown className="mr-1 h-4 w-4" />
            {t('inline.expand')}
          </Button>
        )}

        {mode === 'full' && expanded && (
          <>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.role.label')}</FormLabel>
                  <FormControl>
                    <RoleGrid
                      value={field.value}
                      onChange={field.onChange}
                      disabled={pending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interests"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.interests.label')}</FormLabel>
                  <FormControl>
                    <CheckboxGrid
                      options={interestOptions}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={pending}
                      tPrefix="fields.interests.options"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="useScenes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.useScenes.label')}</FormLabel>
                  <FormControl>
                    <CheckboxGrid
                      options={useSceneOptions}
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={pending}
                      tPrefix="fields.useScenes.options"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {collapsible && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleExpanded}
                className="w-full"
              >
                <ChevronUp className="mr-1 h-4 w-4" />
                {t('inline.collapse')}
              </Button>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={pending} className="min-w-[140px]">
            {pending ? t('actions.submitting') : t('actions.submit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

/* ── 子组件 ── */

function RoleGrid({
  value,
  onChange,
  disabled,
}: {
  value?: WaitlistInput['role']
  onChange: (v: WaitlistInput['role']) => void
  disabled?: boolean
}) {
  const t = useTranslations('waitlist')

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {roleOptions.map((roleKey) => {
        const active = value === roleKey
        return (
          <button
            key={roleKey}
            type="button"
            disabled={disabled}
            onClick={() => onChange(active ? undefined : roleKey)}
            className={cn(
              'rounded-md border px-3 py-2 text-sm transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            {t(`fields.role.options.${roleKey}`)}
          </button>
        )
      })}
    </div>
  )
}

function CheckboxGrid({
  options,
  value,
  onChange,
  disabled,
  tPrefix,
}: {
  options: readonly string[]
  value: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  tPrefix: string
}) {
  const t = useTranslations('waitlist')

  const toggle = (key: string) => {
    onChange(
      value.includes(key) ? value.filter((v) => v !== key) : [...value, key]
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((key) => {
        const checked = value.includes(key)
        return (
          <label
            key={key}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              checked
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <Checkbox
              checked={checked}
              onCheckedChange={() => toggle(key)}
              disabled={disabled}
              className="shrink-0"
            />
            <span>{t(`${tPrefix}.${key}`)}</span>
          </label>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: 创建组件测试**

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WaitlistForm } from './waitlist-form'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'fields.email.label': 'Email',
      'fields.email.placeholder': 'you@example.com',
      'fields.role.label': 'Role',
      'fields.role.options.beginner': 'Beginner',
      'fields.role.options.enthusiast': 'Enthusiast',
      'fields.role.options.indie': 'Indie',
      'fields.role.options.professional': 'Professional',
      'fields.role.options.songwriter': 'Songwriter',
      'fields.role.options.other': 'Other',
      'fields.interests.label': 'Interests',
      'fields.interests.options.composition': 'Composition',
      'fields.interests.options.arrangement': 'Arrangement',
      'fields.interests.options.vocal': 'Vocal',
      'fields.interests.options.mixing': 'Mixing',
      'fields.interests.options.cover': 'Cover',
      'fields.interests.options.lyrics': 'Lyrics',
      'fields.useScenes.label': 'Scenes',
      'fields.useScenes.options.personal': 'Personal',
      'fields.useScenes.options.commercial': 'Commercial',
      'fields.useScenes.options.education': 'Education',
      'fields.useScenes.options.social': 'Social',
      'inline.expand': 'Expand',
      'inline.collapse': 'Collapse',
      'actions.submit': 'Submit',
      'actions.submitting': 'Submitting…',
      'toast.success.title': 'Success',
      'toast.success.description': 'You are on the list',
      'toast.duplicate': 'Duplicate',
      'toast.invalid': 'Invalid',
      'toast.unknown': 'Unknown',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/app/actions/waitlist', () => ({
  joinWaitlist: vi.fn(),
}))

describe('WaitlistForm', () => {
  it('renders email field in simple mode', () => {
    render(<WaitlistForm mode="simple" />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    // simple 模式下没有折叠按钮
    expect(screen.queryByText('Expand')).not.toBeInTheDocument()
  })

  it('renders only email + expand button in full collapsible mode', () => {
    render(<WaitlistForm mode="full" collapsible />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByText('Expand')).toBeInTheDocument()
    expect(screen.queryByText('Role')).not.toBeInTheDocument()
    expect(screen.queryByText('Interests')).not.toBeInTheDocument()
  })

  it('expands to show all fields when expand clicked', async () => {
    render(<WaitlistForm mode="full" collapsible />)
    await userEvent.click(screen.getByText('Expand'))
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Interests')).toBeInTheDocument()
    expect(screen.getByText('Scenes')).toBeInTheDocument()
  })

  it('allows role selection (single)', async () => {
    render(<WaitlistForm mode="simple" />)
    const beginnerBtn = screen.getByText('Beginner')
    await userEvent.click(beginnerBtn)
    expect(beginnerBtn).toHaveClass('border-primary')

    // 切换到另一个角色
    const indieBtn = screen.getByText('Indie')
    await userEvent.click(indieBtn)
    expect(indieBtn).toHaveClass('border-primary')
    expect(beginnerBtn).not.toHaveClass('border-primary')
  })

  it('allows interest multi-selection', async () => {
    render(<WaitlistForm mode="full" />)
    const composition = screen.getByLabelText('Composition')
    const cover = screen.getByLabelText('Cover')

    await userEvent.click(composition)
    await userEvent.click(cover)

    expect(composition).toBeChecked()
    expect(cover).toBeChecked()

    // 取消选择
    await userEvent.click(composition)
    expect(composition).not.toBeChecked()
    expect(cover).toBeChecked()
  })
})
```

- [ ] **Step 3: 运行组件测试**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/apps/web && npx vitest run src/components/waitlist-form.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/waitlist-form.tsx apps/web/src/components/waitlist-form.test.tsx
git commit -m "feat(waitlist): create WaitlistForm component with simple/full modes (#107)"
```

---

## Task 6: 重构 WaitlistDialog

**Files:**
- Modify: `apps/web/src/components/waitlist-dialog.tsx`

- [ ] **Step 1: 替换整个文件内容**

```typescript
'use client'

import { useTranslations } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kiyo/ui'

import { WaitlistForm } from './waitlist-form'
import { useWaitlist } from '@/lib/waitlist-context'

export function WaitlistDialog() {
  const { open, setOpen, hide } = useWaitlist()
  const t = useTranslations('waitlist')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <WaitlistForm mode="simple" onSuccess={hide} />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/waitlist-dialog.tsx
git commit -m "refactor(waitlist): simplify WaitlistDialog to use WaitlistForm (#107)"
```

---

## Task 7: 创建 InlineWaitlistForm（底部内联表单）

**Files:**
- Create: `apps/web/src/components/inline-waitlist-form.tsx`

- [ ] **Step 1: 创建组件**

```typescript
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'

import { WaitlistForm } from './waitlist-form'

export function InlineWaitlistForm() {
  const [submitted, setSubmitted] = React.useState(false)
  const t = useTranslations('waitlist')

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-center text-lg font-medium">
          {t('inline.thanks')}
        </p>
      </div>
    )
  }

  return (
    <WaitlistForm
      mode="full"
      collapsible
      onSuccess={() => setSubmitted(true)}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/inline-waitlist-form.tsx
git commit -m "feat(waitlist): add InlineWaitlistForm for bottom CTA (#107)"
```

---

## Task 8: 更新 FinalCta 组件

**Files:**
- Modify: `apps/web/src/components/sections/final-cta.tsx`

- [ ] **Step 1: 替换整个文件内容**

```typescript
'use client'

import { useTranslations } from 'next-intl'

import { ScrollReveal } from '../scroll-reveal'
import { InlineWaitlistForm } from '../inline-waitlist-form'

export function FinalCta() {
  const t = useTranslations('finalCta')

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_hsl(var(--kiyo-purple)/0.18),_transparent_60%)]"
      />
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {t('headline.prefix')}
            <span className="bg-gradient-to-r from-kiyo-purple to-kiyo-cyan bg-clip-text text-transparent">
              {' '}
              {t('headline.highlight')}
              {' '}
            </span>
            {t('headline.suffix')}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('description')}
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <InlineWaitlistForm />
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/sections/final-cta.tsx
git commit -m "feat(waitlist): replace FinalCta buttons with InlineWaitlistForm (#107)"
```

---

## Task 9: 更新中文 i18n 文案

**Files:**
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: 修改 waitlist 节点**

找到 `apps/web/messages/zh.json` 中的 `"waitlist"` 对象，替换为：

```json
  "waitlist": {
    "title": "加入 Kiyo Waitlist",
    "description": "留下邮箱，上线第一时间告诉你。",
    "inline": {
      "expand": "展开更多，帮助我们了解你的需求",
      "collapse": "收起",
      "thanks": "已加入！感谢你的支持，上线时我们会第一时间通知你。"
    },
    "fields": {
      "email": {
        "label": "邮箱",
        "placeholder": "you@example.com"
      },
      "role": {
        "label": "你在音乐创作中的角色（可选）",
        "options": {
          "beginner": "音乐初学者",
          "enthusiast": "音乐爱好者",
          "indie": "独立制作人",
          "professional": "专业音乐人",
          "songwriter": "词曲作者",
          "other": "其他"
        }
      },
      "interests": {
        "label": "感兴趣的功能（可多选）",
        "options": {
          "composition": "AI 作曲",
          "arrangement": "AI 编曲",
          "vocal": "人声合成",
          "mixing": "混音母带",
          "cover": "AI 翻唱",
          "lyrics": "智能歌词创作"
        }
      },
      "useScenes": {
        "label": "使用场景（可多选）",
        "options": {
          "personal": "个人创作",
          "commercial": "商业项目",
          "education": "教育学习",
          "social": "社交分享"
        }
      }
    },
    "actions": {
      "cancel": "取消",
      "submit": "加入 Waitlist",
      "submitting": "提交中…"
    },
    "toast": {
      "success": {
        "title": "已加入 Waitlist！",
        "description": "上线第一时间会发邮件通知你。"
      },
      "duplicate": "该邮箱已在 Waitlist 中。如需更新信息，请联系 hello@kiyo.ai。",
      "invalid": "请检查邮箱格式后重试。",
      "unknown": "稍后再试一次，或邮件联系 hello@kiyo.ai。"
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/zh.json
git commit -m "feat(i18n): add new waitlist fields in Chinese (#107)"
```

---

## Task 10: 更新英文 i18n 文案

**Files:**
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 waitlist 节点**

找到 `apps/web/messages/en.json` 中的 `"waitlist"` 对象，替换为：

```json
  "waitlist": {
    "title": "Join the Kiyo Waitlist",
    "description": "Leave your email and we'll tell you the moment we launch.",
    "inline": {
      "expand": "Show more to help us understand your needs",
      "collapse": "Collapse",
      "thanks": "You're in! Thanks for your support — we'll notify you the moment we launch."
    },
    "fields": {
      "email": {
        "label": "Email",
        "placeholder": "you@example.com"
      },
      "role": {
        "label": "Your role in music creation (optional)",
        "options": {
          "beginner": "Music Beginner",
          "enthusiast": "Music Enthusiast",
          "indie": "Indie Producer",
          "professional": "Professional Musician",
          "songwriter": "Songwriter",
          "other": "Other"
        }
      },
      "interests": {
        "label": "Features you're interested in (multiple)",
        "options": {
          "composition": "AI Composition",
          "arrangement": "AI Arrangement",
          "vocal": "Vocal Synthesis",
          "mixing": "Mixing & Mastering",
          "cover": "AI Cover",
          "lyrics": "Smart Lyrics Writing"
        }
      },
      "useScenes": {
        "label": "Usage scenarios (multiple)",
        "options": {
          "personal": "Personal Creation",
          "commercial": "Commercial Projects",
          "education": "Education",
          "social": "Social Sharing"
        }
      }
    },
    "actions": {
      "cancel": "Cancel",
      "submit": "Join Waitlist",
      "submitting": "Submitting…"
    },
    "toast": {
      "success": {
        "title": "You're on the waitlist!",
        "description": "We'll email you the moment we launch."
      },
      "duplicate": "This email is already on the waitlist. Contact hello@kiyo.ai to update your info.",
      "invalid": "Please check your email format and try again.",
      "unknown": "Try again later, or reach us at hello@kiyo.ai."
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/en.json
git commit -m "feat(i18n): add new waitlist fields in English (#107)"
```

---

## Task 11: 类型检查与构建验证

- [ ] **Step 1: 运行类型检查**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/apps/web && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 2: 运行测试**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo/apps/web && npx vitest run
```

Expected: 所有测试通过（包括 waitlist.test.ts 和 waitlist-form.test.tsx）

- [ ] **Step 3: Commit（如全部通过则标记完成）**

```bash
# 如有 lint/type 修复，单独 commit
git add -A
git commit -m "chore(waitlist): type-check and test pass (#107)"
```

---

## 自我审查

### Spec 覆盖检查

| Spec 需求 | 对应 Task |
|---|---|
| 新增角色字段（6 个选项） | Task 2 (schema), Task 5 (UI), Task 9/10 (i18n) |
| 新增功能偏好多选（6 个选项） | Task 2, Task 5, Task 9/10 |
| 新增使用场景多选（4 个选项） | Task 2, Task 5, Task 9/10 |
| Hero 保持简洁（simple 模式） | Task 6 (WaitlistDialog) |
| 底部展开完整表单（full 模式+折叠） | Task 7 (InlineWaitlistForm), Task 8 (FinalCta) |
| 数据库迁移 | Task 1 |
| Server Action 写入新列 | Task 3 |
| 测试覆盖 | Task 4 (action), Task 5 (component), Task 11 (验证) |

### Placeholder 扫描

- ✅ 无 TBD/TODO
- ✅ 无 "appropriate error handling" 等模糊描述
- ✅ 所有步骤包含完整代码
- ✅ 所有测试包含实际断言代码

### 类型一致性

- `WaitlistInput` 定义于 Task 2，被 Task 3 (server action)、Task 5 (component) 引用
- `roleOptions`/`interestOptions`/`useSceneOptions` 定义于 Task 2，被 Task 5 的 `CheckboxGrid` 使用
- `WaitlistFormProps` 的 `mode` 类型为 `'simple' | 'full'`，与 Task 6/7 调用一致
- i18n 键路径 `fields.role.options.*`、`fields.interests.options.*`、`fields.useScenes.options.*` 在组件和 JSON 中完全匹配
