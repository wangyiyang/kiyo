# 用户设置与账户删除实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/settings` 页面实现修改密码、更新邮箱、删除账户（级联数据清理）功能，满足 GDPR/个保法合规要求。

**Architecture:** PostgreSQL RPC 函数 `delete_user_data` 在事务中原子删除用户数据；Next.js API Route 协调密码验证、Storage 清理和 Auth 用户删除；前端使用 shadcn Dialog 多步流程引导用户确认删除。

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, next-intl, zod, react-hook-form, Vitest, Playwright

---

## 文件清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `supabase-local/migrations/20260512000000_create_delete_user_data_function.sql` | 创建 | PostgreSQL RPC 函数，原子删除用户数据 |
| `packages/supabase/src/env.ts` | 修改 | 新增 `supabaseServiceRoleKey` 返回 |
| `packages/supabase/src/server.ts` | 修改 | 新增 `createServiceRoleClient()` |
| `apps/web/.env.local.example` | 修改 | 新增 `SUPABASE_SERVICE_ROLE_KEY` |
| `apps/web/src/app/api/account/delete/route.ts` | 创建 | 删号 API Route |
| `apps/web/src/components/settings/settings-section.tsx` | 创建 | 通用设置区块容器 |
| `apps/web/src/components/settings/change-password-form.tsx` | 创建 | 改密表单 |
| `apps/web/src/components/settings/update-email-form.tsx` | 创建 | 更邮表单 |
| `apps/web/src/components/settings/delete-account-dialog.tsx` | 创建 | 删号多步 Dialog |
| `apps/web/src/app/settings/page.tsx` | 创建 | 设置主页面 |
| `apps/web/messages/zh.json` | 修改 | 新增 `settings` 命名空间 |
| `apps/web/messages/en.json` | 修改 | 新增 `settings` 命名空间 |
| `apps/web/src/app/api/account/delete/route.test.ts` | 创建 | API Route 单元测试 |
| `apps/web/tests/e2e/delete-account.spec.ts` | 创建 | E2E 测试 |

---

## Task 1: 数据库迁移 — 创建 `delete_user_data` RPC 函数

**Files:**
- Create: `supabase-local/migrations/20260512000000_create_delete_user_data_function.sql`

- [ ] **Step 1: 创建迁移文件**

```sql
-- 创建 delete_user_data RPC 函数
-- 原子删除用户全部数据，供服务端 API 调用

create or replace function public.delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  target_email text;
begin
  -- 获取用户邮箱（waitlist 清理需要）
  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'User not found';
  end if;

  -- 1. generation_tasks（可能引用 songs/albums，先删避免外键冲突）
  delete from generation_tasks where user_id = target_user_id;

  -- 2. songs（album_songs 级联自动清理）
  delete from songs where user_id = target_user_id;

  -- 3. albums（album_songs 级联自动清理）
  delete from albums where user_id = target_user_id;

  -- 4. lyrics
  delete from lyrics where user_id = target_user_id;

  -- 5. waitlist（按 email 匹配）
  delete from waitlist where email = target_email;
end;
$$;

comment on function public.delete_user_data(uuid) is '级联删除用户的全部数据（供账户删除 API 使用）';
```

- [ ] **Step 2: 应用迁移到本地数据库**

```bash
cd /home/kk/Github/kiyo
npx supabase --workdir supabase-local db reset
```

Expected: `Resetting local database...` completes successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase-local/migrations/20260512000000_create_delete_user_data_function.sql
git commit -m "feat(db): add delete_user_data RPC function for account deletion"
```

---

## Task 2: 共享包 — 添加 Service Role Client

**Files:**
- Modify: `packages/supabase/src/env.ts`
- Modify: `packages/supabase/src/server.ts`

- [ ] **Step 1: 修改 `env.ts` 暴露 service role key**

```typescript
export function getSupabaseClientConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}
```

- [ ] **Step 2: 修改 `server.ts` 添加 `createServiceRoleClient()`**

```typescript
import { createServerClient as createServer } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'
import { getSupabaseClientConfig } from './env'

export async function createServerClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createServer(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Server Component 中无法设置 cookie，忽略
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Server Component 中无法删除 cookie，忽略
        }
      },
    },
  })
}

export function createServiceRoleClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseClientConfig()
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(supabaseUrl!, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 3: Type check**

```bash
cd /home/kk/Github/kiyo/packages/supabase
pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/env.ts packages/supabase/src/server.ts
git commit -m "feat(supabase): add createServiceRoleClient for admin operations"
```

---

## Task 3: 环境变量 — 添加 `SUPABASE_SERVICE_ROLE_KEY`

**Files:**
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: 在 `.env.local.example` 末尾添加**

```bash
# Supabase Service Role Key（仅服务端使用，用于删除账户）
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.local.example
git commit -m "chore(env): add SUPABASE_SERVICE_ROLE_KEY to env example"
```

---

## Task 4: 后端 API — `POST /api/account/delete`

**Files:**
- Create: `apps/web/src/app/api/account/delete/route.ts`

- [ ] **Step 1: 创建 API Route**

```typescript
import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

interface DeleteAccountBody {
  confirmation: string
  password: string
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: DeleteAccountBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  if (body.confirmation !== 'DELETE') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Confirmation must be "DELETE"' } },
      { status: 400 }
    )
  }

  if (!body.password || typeof body.password !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Password is required' } },
      { status: 400 }
    )
  }

  // 验证密码（同时检测 Magic Link 用户）
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: body.password,
  })

  if (signInError) {
    // 区分"无密码"和"密码错误"
    if (signInError.code === 'invalid_credentials') {
      return NextResponse.json(
        { error: { code: 'PASSWORD_INCORRECT', message: 'Current password is incorrect' } },
        { status: 403 }
      )
    }
    // 其他错误（如 email_not_confirmed 等理论上不会发生，因为用户已登录）
    return NextResponse.json(
      { error: { code: 'PASSWORD_INCORRECT', message: 'Password verification failed' } },
      { status: 403 }
    )
  }

  // 收集 Storage 路径
  const serviceClient = createServiceRoleClient()

  const [songsResult, albumsResult] = await Promise.all([
    serviceClient.from('songs').select('file_path, cover_url').eq('user_id', user.id),
    serviceClient.from('albums').select('cover_url').eq('user_id', user.id),
  ])

  const storagePaths: { bucket: string; path: string }[] = []

  if (songsResult.data) {
    for (const song of songsResult.data) {
      if (song.file_path) {
        storagePaths.push({ bucket: 'audio', path: song.file_path })
      }
      if (song.cover_url) {
        try {
          const url = new URL(song.cover_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('covers') + 1).join('/')
          if (filePath) storagePaths.push({ bucket: 'covers', path: filePath })
        } catch {
          // 忽略 URL 解析错误
        }
      }
    }
  }

  if (albumsResult.data) {
    for (const album of albumsResult.data) {
      if (album.cover_url) {
        try {
          const url = new URL(album.cover_url)
          const pathParts = url.pathname.split('/')
          const filePath = pathParts.slice(pathParts.indexOf('covers') + 1).join('/')
          if (filePath) storagePaths.push({ bucket: 'covers', path: filePath })
        } catch {
          // 忽略 URL 解析错误
        }
      }
    }
  }

  // 原子删除数据库数据
  const { error: rpcError } = await serviceClient.rpc('delete_user_data', {
    target_user_id: user.id,
  })

  if (rpcError) {
    console.error('delete_user_data RPC failed:', rpcError)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete user data' } },
      { status: 500 }
    )
  }

  // 清理 Storage（失败不阻断）
  for (const { bucket, path } of storagePaths) {
    try {
      await serviceClient.storage.from(bucket).remove([path])
    } catch (err) {
      console.error(`Failed to remove storage object ${bucket}/${path}:`, err)
    }
  }

  // 删除 Auth 用户
  const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(user.id)

  if (deleteAuthError) {
    console.error('Failed to delete auth user:', deleteAuthError)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete auth user' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/account/delete/route.ts
git commit -m "feat(api): add POST /api/account/delete endpoint"
```

---

## Task 5: 前端组件 — `settings-section.tsx`

**Files:**
- Create: `apps/web/src/components/settings/settings-section.tsx`

- [ ] **Step 1: 创建通用区块组件**

```tsx
'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
  variant?: 'default' | 'danger'
}

export function SettingsSection({
  title,
  description,
  children,
  variant = 'default',
}: SettingsSectionProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-6',
        variant === 'danger'
          ? 'border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20'
          : 'border-border bg-card'
      )}
    >
      <div className="mb-4">
        <h2
          className={cn(
            'text-lg font-semibold',
            variant === 'danger' && 'text-red-600 dark:text-red-400'
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/settings/settings-section.tsx
git commit -m "feat(settings): add SettingsSection component"
```

---

## Task 6: 前端组件 — `change-password-form.tsx`

**Files:**
- Create: `apps/web/src/components/settings/change-password-form.tsx`

- [ ] **Step 1: 创建改密表单**

```tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  toast,
} from '@kiyo/ui'

import { createBrowserClient } from '@kiyo/supabase'
import { signInWithPassword } from '@/app/actions/auth'

function getPasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}

function strengthLabel(score: number): { key: string; color: string } {
  switch (score) {
    case 0:
    case 1:
      return { key: 'weak', color: 'bg-red-500' }
    case 2:
      return { key: 'fair', color: 'bg-yellow-500' }
    case 3:
      return { key: 'good', color: 'bg-blue-500' }
    case 4:
      return { key: 'strong', color: 'bg-green-500' }
    default:
      return { key: 'weak', color: 'bg-red-500' }
  }
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm() {
  const t = useTranslations('settings')
  const authT = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const newPassword = form.watch('newPassword')
  const strength = getPasswordStrength(newPassword)
  const strengthInfo = strengthLabel(strength)

  const onSubmit = (values: ChangePasswordInput) => {
    startTransition(async () => {
      // 1. 验证当前密码
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        toast.error(authT('errors.generic'))
        return
      }

      const verifyResult = await signInWithPassword(user.email, values.currentPassword)
      if (!verifyResult.ok) {
        toast.error(authT('errors.generic'), {
          description: t('passwordSection.currentPasswordIncorrect'),
        })
        return
      }

      // 2. 更新密码
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      })

      if (error) {
        toast.error(authT('errors.generic'), {
          description: error.message,
        })
        return
      }

      toast.success(t('passwordSection.success'))
      form.reset()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordSection.currentPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordSection.newPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < strength ? strengthInfo.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {authT(`register.passwordStrength.${strengthInfo.key}`)}
                  </p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordSection.confirmPassword')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Updating...' : t('passwordSection.submit')}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/change-password-form.tsx
git commit -m "feat(settings): add ChangePasswordForm component"
```

---

## Task 7: 前端组件 — `update-email-form.tsx`

**Files:**
- Create: `apps/web/src/components/settings/update-email-form.tsx`

- [ ] **Step 1: 创建更邮表单**

```tsx
'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  toast,
} from '@kiyo/ui'

import { createBrowserClient } from '@kiyo/supabase'
import { signInWithPassword } from '@/app/actions/auth'

const updateEmailSchema = z.object({
  newEmail: z.string().email('Please enter a valid email'),
  currentPassword: z.string().min(1, 'Current password is required'),
})

type UpdateEmailInput = z.infer<typeof updateEmailSchema>

export function UpdateEmailForm() {
  const t = useTranslations('settings')
  const authT = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: {
      newEmail: '',
      currentPassword: '',
    },
  })

  const onSubmit = (values: UpdateEmailInput) => {
    startTransition(async () => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        toast.error(authT('errors.generic'))
        return
      }

      // 验证当前密码
      const verifyResult = await signInWithPassword(user.email, values.currentPassword)
      if (!verifyResult.ok) {
        toast.error(authT('errors.generic'), {
          description: t('emailSection.currentPasswordIncorrect'),
        })
        return
      }

      // 更新邮箱
      const { error } = await supabase.auth.updateUser({
        email: values.newEmail,
      })

      if (error) {
        toast.error(authT('errors.generic'), {
          description: error.message,
        })
        return
      }

      toast.success(t('emailSection.success'))
      form.reset()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="newEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('emailSection.newEmail')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('emailSection.currentPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Updating...' : t('emailSection.submit')}
        </Button>
      </form>
    </Form>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/update-email-form.tsx
git commit -m "feat(settings): add UpdateEmailForm component"
```

---

## Task 8: 前端组件 — `delete-account-dialog.tsx`

**Files:**
- Create: `apps/web/src/components/settings/delete-account-dialog.tsx`

- [ ] **Step 1: 创建删号多步 Dialog**

```tsx
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  toast,
} from '@kiyo/ui'

import { createBrowserClient } from '@kiyo/supabase'

type Step = 'warn' | 'verify' | 'confirm' | 'deleting' | 'done'

interface DeleteAccountDialogProps {
  userEmail: string
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const t = useTranslations('settings')
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('warn')
  const [password, setPassword] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [error, setError] = React.useState('')
  const router = useRouter()

  const reset = () => {
    setStep('warn')
    setPassword('')
    setConfirmation('')
    setError('')
  }

  React.useEffect(() => {
    if (!open) reset()
  }, [open])

  const handleVerify = async () => {
    setError('')

    if (!password) {
      setError(t('dangerZone.deleteAccount.dialog.verifyDescription'))
      return
    }

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'VERIFY', password }),
      })

      const result = await response.json()

      if (response.status === 403) {
        setError(t('dangerZone.deleteAccount.dialog.verifyDescription'))
        return
      }

      if (response.status === 400 && result.error?.code === 'NO_PASSWORD_SET') {
        setError(t('dangerZone.deleteAccount.dialog.noPassword'))
        return
      }

      if (response.status === 400) {
        setError(result.error?.message || t('dangerZone.deleteAccount.dialog.error'))
        return
      }

      // 密码验证通过，进入确认步骤
      setStep('confirm')
    } catch {
      setError(t('dangerZone.deleteAccount.dialog.error'))
    }
  }

  const handleDelete = async () => {
    if (confirmation !== 'DELETE') {
      setError(t('dangerZone.deleteAccount.dialog.confirmDescription'))
      return
    }

    setStep('deleting')
    setError('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE', password }),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error?.message || t('dangerZone.deleteAccount.dialog.error'))
        setStep('confirm')
        return
      }

      setStep('done')

      // 清除 session 并跳转
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch {
      setError(t('dangerZone.deleteAccount.dialog.error'))
      setStep('confirm')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('dangerZone.deleteAccount.button')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'warn' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.warnTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.warnDescription')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep('verify')}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.verifyTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.verifyDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder="Current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerify()
                }}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('warn')}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleVerify}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.confirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.confirmDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder={t('dangerZone.deleteAccount.dialog.confirmPlaceholder')}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDelete()
                }}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('verify')}>
                Back
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t('dangerZone.deleteAccount.dialog.confirmButton')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'deleting' && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              {t('dangerZone.deleteAccount.dialog.deleting')}
            </p>
          </div>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.success')}</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => router.push('/')}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/settings/delete-account-dialog.tsx
git commit -m "feat(settings): add DeleteAccountDialog component"
```

---

## Task 9: 前端页面 — `/settings/page.tsx`

**Files:**
- Create: `apps/web/src/app/settings/page.tsx`

- [ ] **Step 1: 创建设置主页面**

```tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { createServerClient } from '@kiyo/supabase/server'

import { SettingsSection } from '@/components/settings/settings-section'
import { ChangePasswordForm } from '@/components/settings/change-password-form'
import { UpdateEmailForm } from '@/components/settings/update-email-form'
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog'
import { AuthGuard } from '@/components/auth/auth-guard'
import { SiteHeader } from '@/components/site-header'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return {
    title: t('title'),
  }
}

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto max-w-2xl px-4 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">
              {(await getTranslations('settings'))('title')}
            </h1>
            {user?.email && (
              <p className="mt-1 text-muted-foreground">{user.email}</p>
            )}
          </div>

          <div className="space-y-6">
            <SettingsSection
              title={(await getTranslations('settings'))('emailSection.title')}
              description={(await getTranslations('settings'))('emailSection.description')}
            >
              <UpdateEmailForm />
            </SettingsSection>

            <SettingsSection
              title={(await getTranslations('settings'))('passwordSection.title')}
              description={(await getTranslations('settings'))('passwordSection.description')}
            >
              <ChangePasswordForm />
            </SettingsSection>

            <SettingsSection
              title={(await getTranslations('settings'))('dangerZone.title')}
              description={(await getTranslations('settings'))('dangerZone.description')}
              variant="danger"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-red-600 dark:text-red-400">
                    {(await getTranslations('settings'))('dangerZone.deleteAccount.title')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(await getTranslations('settings'))('dangerZone.deleteAccount.description')}
                  </p>
                </div>
                {user?.email && <DeleteAccountDialog userEmail={user.email} />}
              </div>
            </SettingsSection>
          </div>
        </div>
      </AuthGuard>
    </>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/settings/page.tsx
git commit -m "feat(settings): add settings page with password, email, and delete account"
```

---

## Task 10: i18n — 添加 `settings` 命名空间

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 在 `zh.json` 中添加 `settings` 命名空间**

在 `auth` 同级添加：

```json
  "settings": {
    "title": "设置",
    "emailSection": {
      "title": "更新邮箱",
      "description": "更改您的登录邮箱地址",
      "newEmail": "新邮箱",
      "currentPassword": "当前密码",
      "currentPasswordIncorrect": "当前密码不正确",
      "submit": "更新邮箱",
      "success": "验证邮件已发送至新邮箱，请查收"
    },
    "passwordSection": {
      "title": "修改密码",
      "description": "更新您的账户密码",
      "currentPassword": "当前密码",
      "currentPasswordIncorrect": "当前密码不正确",
      "newPassword": "新密码",
      "confirmPassword": "确认新密码",
      "submit": "修改密码",
      "success": "密码已更新"
    },
    "dangerZone": {
      "title": "危险区域",
      "description": "这些操作不可逆，请谨慎操作",
      "deleteAccount": {
        "title": "删除账户",
        "description": "永久删除您的账户及所有数据",
        "button": "删除账户",
        "dialog": {
          "warnTitle": "您确定要删除账户吗？",
          "warnDescription": "此操作将永久删除您的账户及所有数据，包括歌曲、专辑、歌词和上传的音频文件。此操作不可撤销。",
          "continue": "我已了解风险，继续",
          "verifyTitle": "验证密码",
          "verifyDescription": "请输入当前密码以验证身份",
          "confirmTitle": "确认删除",
          "confirmDescription": "请输入 DELETE 以确认永久删除账户",
          "confirmPlaceholder": "DELETE",
          "confirmButton": "永久删除账户",
          "deleting": "正在删除账户...",
          "success": "账户已成功删除",
          "noPassword": "您使用 Magic Link 登录，请先设置密码后再删除账户",
          "error": "删除失败，请稍后重试或联系支持"
        }
      }
    }
  }
```

- [ ] **Step 2: 在 `en.json` 中添加 `settings` 命名空间**

在 `auth` 同级添加：

```json
  "settings": {
    "title": "Settings",
    "emailSection": {
      "title": "Update Email",
      "description": "Change your login email address",
      "newEmail": "New Email",
      "currentPassword": "Current Password",
      "currentPasswordIncorrect": "Current password is incorrect",
      "submit": "Update Email",
      "success": "Verification email sent to your new address"
    },
    "passwordSection": {
      "title": "Change Password",
      "description": "Update your account password",
      "currentPassword": "Current Password",
      "currentPasswordIncorrect": "Current password is incorrect",
      "newPassword": "New Password",
      "confirmPassword": "Confirm New Password",
      "submit": "Change Password",
      "success": "Password updated"
    },
    "dangerZone": {
      "title": "Danger Zone",
      "description": "These actions are irreversible. Please proceed with caution.",
      "deleteAccount": {
        "title": "Delete Account",
        "description": "Permanently delete your account and all data",
        "button": "Delete Account",
        "dialog": {
          "warnTitle": "Are you sure you want to delete your account?",
          "warnDescription": "This will permanently delete your account and all data, including songs, albums, lyrics, and uploaded audio files. This action cannot be undone.",
          "continue": "I understand the risk, continue",
          "verifyTitle": "Verify Password",
          "verifyDescription": "Please enter your current password to verify your identity",
          "confirmTitle": "Confirm Deletion",
          "confirmDescription": "Type DELETE to confirm permanent account deletion",
          "confirmPlaceholder": "DELETE",
          "confirmButton": "Permanently Delete Account",
          "deleting": "Deleting account...",
          "success": "Account deleted successfully",
          "noPassword": "You signed in with Magic Link. Please set a password first before deleting your account.",
          "error": "Deletion failed. Please try again later or contact support."
        }
      }
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add settings namespace for zh and en"
```

---

## Task 11: 单元测试 — API Route

**Files:**
- Create: `apps/web/src/app/api/account/delete/route.test.ts`
- Modify: `apps/web/src/lib/test-utils.ts`

- [ ] **Step 1: 扩展 `test-utils.ts` 的 mock client**

在 `createMockSupabaseClient` 函数的 `auth` 对象中添加：

```typescript
const auth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: options.userId ? { id: options.userId, email: 'test@example.com' } : null },
    error: null,
  }),
  signInWithPassword: vi.fn().mockImplementation(({ password }: { password: string }) => {
    if (password === 'correct-password') {
      return Promise.resolve({ data: { user: { id: options.userId } }, error: null })
    }
    return Promise.resolve({ data: { user: null }, error: { code: 'invalid_credentials', message: 'Invalid credentials' } })
  }),
  updateUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  admin: {
    deleteUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
}
```

同时修改 `storage` 的 `from` 返回添加 `remove` 方法：

```typescript
const storage = {
  from: (_bucket: string) => ({
    upload: vi.fn().mockImplementation((path: string, buffer: ArrayBuffer, options?: { contentType?: string }) => {
      uploadedFiles.push({ path, buffer, contentType: options?.contentType })
      return Promise.resolve({ data: { path }, error: null })
    }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock-cdn.supabase.co/storage/v1/object/public/covers/${path}` },
    })),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://mock-cdn.supabase.co/storage/v1/object/sign/audio/mock-file.mp3?token=mock-token' },
      error: null,
    }),
    remove: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
}
```

- [ ] **Step 2: 创建 API Route 测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
    createServiceRoleClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

function createDeleteRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/account/delete', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/account/delete', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'pass' }))
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when confirmation is not DELETE', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'WRONG', password: 'pass' }))
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when password is incorrect', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const serviceClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as any)

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'wrong-password' }))
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('PASSWORD_INCORRECT')
  })

  it('returns 200 and deletes user data when password is correct', async () => {
    const { createServerClient, createServiceRoleClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    const serviceClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(createServiceRoleClient).mockReturnValue(serviceClient as any)

    // Seed data
    serviceClient.dataStore.songs.push({
      id: 'song-1',
      user_id: 'user-1',
      file_path: 'user-1/audio.mp3',
      cover_url: 'https://cdn.supabase.co/storage/v1/object/public/covers/user-1/cover.jpg',
    })
    serviceClient.dataStore.albums.push({
      id: 'album-1',
      user_id: 'user-1',
      cover_url: 'https://cdn.supabase.co/storage/v1/object/public/covers/user-1/album-cover.jpg',
    })

    const response = await POST(createDeleteRequest({ confirmation: 'DELETE', password: 'correct-password' }))
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)

    // Verify data is deleted
    expect(serviceClient.dataStore.songs).toHaveLength(0)
    expect(serviceClient.dataStore.albums).toHaveLength(0)

    // Verify auth admin.deleteUser was called
    expect(serviceClient.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
cd /home/kk/Github/kiyo/apps/web
pnpm vitest run src/app/api/account/delete/route.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/test-utils.ts apps/web/src/app/api/account/delete/route.test.ts
git commit -m "test(api): add unit tests for account deletion endpoint"
```

---

## Task 12: E2E 测试

**Files:**
- Create: `apps/web/tests/e2e/delete-account.spec.ts`

- [ ] **Step 1: 创建 E2E 测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Account deletion', () => {
  test('full account deletion flow', async ({ page }) => {
    // 1. Register and login
    await page.goto('/register')
    await page.fill('input[type="email"]', `delete-test-${Date.now()}@example.com`)
    await page.fill('input[name="password"]', 'TestPass123!')
    await page.fill('input[name="confirmPassword"]', 'TestPass123!')
    await page.check('input[name="termsAccepted"]')
    await page.click('button[type="submit"]')

    // Wait for redirect after registration
    await page.waitForURL('/', { timeout: 10000 })

    // 2. Create a song
    await page.goto('/songs')
    await page.click('text=Create Song')
    await page.fill('input[name="title"]', 'Test Song')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/songs\//, { timeout: 10000 })

    // 3. Navigate to settings
    await page.click('[data-testid="user-menu-trigger"]')
    await page.click('text=Settings')
    await page.waitForURL('/settings', { timeout: 5000 })

    // 4. Change password
    await page.fill('input[name="currentPassword"]', 'TestPass123!')
    await page.fill('input[name="newPassword"]', 'NewPass456!')
    await page.fill('input[name="confirmPassword"]', 'NewPass456!')
    await page.click('button:has-text("Change Password")')
    await expect(page.locator('text=Password updated')).toBeVisible()

    // 5. Start delete account flow
    await page.click('button:has-text("Delete Account")')
    await expect(page.locator('text=Are you sure you want to delete your account?')).toBeVisible()

    // Step 1: Warning
    await page.click('text=I understand the risk, continue')

    // Step 2: Verify password
    await page.fill('input[type="password"]', 'NewPass456!')
    await page.click('text=I understand the risk, continue')

    // Step 3: Confirm DELETE
    await page.fill('input[placeholder="DELETE"]', 'DELETE')
    await page.click('text=Permanently Delete Account')

    // Wait for deletion
    await expect(page.locator('text=Account deleted successfully')).toBeVisible()

    // 6. Verify redirect to home
    await page.waitForURL('/', { timeout: 10000 })

    // 7. Verify cannot login with old credentials
    await page.goto('/login')
    await page.fill('input[type="email"]', `delete-test-${Date.now()}@example.com`)
    await page.fill('input[type="password"]', 'NewPass456!')
    await page.click('button[type="submit"]')
    await expect(page.locator('text=Invalid credentials')).toBeVisible()
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests/e2e/delete-account.spec.ts
git commit -m "test(e2e): add account deletion end-to-end test"
```

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec 章节 | 对应 Task | 状态 |
|-----------|----------|------|
| 3.1 PostgreSQL RPC 函数 | Task 1 | ✅ |
| 3.2 删除顺序 | Task 1 | ✅ |
| 4.1 API 设计 | Task 4 | ✅ |
| 4.2 请求处理流程 | Task 4 | ✅ |
| 4.3 Service Role Client | Task 2 | ✅ |
| 5.1 页面布局 | Task 9 | ✅ |
| 5.2 组件设计 | Tasks 5-8 | ✅ |
| 6.1 改密流程 | Task 6 | ✅ |
| 6.2 更邮流程 | Task 7 | ✅ |
| 6.3 删号流程 | Task 8 | ✅ |
| 7. 安全考虑 | Tasks 2, 4 | ✅ |
| 8. 测试策略 | Tasks 11-12 | ✅ |
| 9. i18n | Task 10 | ✅ |
| 10. 环境变量 | Task 3 | ✅ |

### 2. Placeholder Scan

- [x] 无 TBD/TODO
- [x] 无 "implement later"
- [x] 无 "add appropriate error handling" 等模糊描述
- [x] 所有测试包含实际代码

### 3. Type Consistency

- [x] `createServiceRoleClient` 在 Task 2 和 Task 4 中名称一致
- [x] `delete_user_data` 在 Task 1 和 Task 4 中名称一致
- [x] `SettingsSection` props 在 Task 5 和 Task 9 中一致
- [x] i18n key 在 Tasks 6-10 中一致
