# Issue #135: 创建类入口认证拦截设计

日期: 2026-05-12
议题: fix(auth): 未登录用户可进入创建表单，保存后才暴露认证失败

## 1. 背景

当前项目中，以下创建入口对未登录用户开放：

- `/songs/new` — 页面级创建表单（Client Component）
- `/lyrics/new` — 页面级创建表单（Client Component）
- `/albums` 列表页「新建专辑」弹窗 — Dialog 组件

未登录用户可进入表单/弹窗填写内容，点击保存后 API 返回英文 `Authentication required` 错误，且无登录引导路径。这是核心创作链路的高摩擦死路。

## 2. 目标

- 未登录用户无法进入任何创建表单/弹窗
- 拦截后提供清晰的登录引导，登录后返回原意图页面
- 保存失败时的错误提示为中文，且包含可操作指引
- 所有创建入口的认证策略在效果上保持一致

## 3. 设计决策

采用 **严格入口拦截** 策略（方案 A）：

- 页面级创建（歌曲、歌词）使用 Server Component layout 做服务端拦截
- 列表页「新建」按钮使用客户端 `AuthGuardButton` 做点击拦截，避免白屏闪烁
- 专辑弹窗在打开时做客户端 session 检查
- 登录页支持 `redirectTo` 参数，登录后返回原意图页面

## 4. 详细方案

### 4.1 页面级入口拦截

在以下路径新增 `layout.tsx`（async Server Component）：

**`apps/web/src/app/[locale]/songs/new/layout.tsx`**
```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

export default async function NewSongLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login?redirectTo=/songs/new')
  }
  return <>{children}</>
}
```

**`apps/web/src/app/[locale]/lyrics/new/layout.tsx`**
同理，redirectTo 为 `/lyrics/new`。

现有 `page.tsx` 无需任何改动。

### 4.2 列表页按钮拦截

新建 `AuthGuardButton` 客户端组件（`apps/web/src/components/auth/auth-guard-button.tsx`）：

```tsx
'use client'

import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { createBrowserClient } from '@kiyo/supabase/client'

interface AuthGuardButtonProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function AuthGuardButton({ href, children, className }: AuthGuardButtonProps) {
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/login?redirectTo=${encodeURIComponent(href)}`)
      return
    }
    router.push(href)
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
```

使用 `<a>` 标签保留可访问性语义和默认导航行为（JS 失败时作为优雅降级）。

改造列表页按钮：

**`apps/web/src/app/[locale]/songs/page.tsx`**
原「新建歌曲」`<Link>` 改为 `<AuthGuardButton>`，保持 className 不变。

**`apps/web/src/app/[locale]/lyrics/page.tsx`**
同理改造「新建歌词」按钮。

### 4.3 专辑弹窗拦截

**`apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx`**

在 `mode === 'create'` 时，弹窗打开前检查 session：

```tsx
const handleOpenChange = (newOpen: boolean) => {
  if (newOpen && mode === 'create') {
    createBrowserClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login?redirectTo=/albums')
        return
      }
      setOpen(true)
    })
  } else {
    setOpen(newOpen)
  }
}

return (
  <Dialog open={open} onOpenChange={handleOpenChange}>
    ...
  </Dialog>
)
```

未登录用户点击「新建专辑」后，弹窗不打开，直接跳转登录页，登录后返回专辑列表页。

### 4.4 登录后返回机制

**密码登录** — 已支持 `redirectTo`，无需改动。

**OAuth 登录** — 修改 `signInWithOAuth` server action：

```ts
export async function signInWithOAuth(
  provider: 'github' | 'google',
  next?: string
): Promise<never> {
  const redirectTo = next
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  // ...
}
```

`OAuthButtons` 组件使用 `useSearchParams` 读取 `redirectTo` 并传入。

**Magic Link 登录** — 同理修改 `sendMagicLink`：

```ts
export async function sendMagicLink(email: string, next?: string): Promise<AuthResult> {
  const emailRedirectTo = next
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=${encodeURIComponent(next)}`
    : `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  // ...
}
```

`MagicLinkForm` 同样读取 `redirectTo` query param 传入。

**登录页** — `login/page.tsx` 接收 `searchParams` 并传给 `AuthGuard`：

```tsx
export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string }
}) {
  return (
    <AuthGuard redirectTo={searchParams.redirectTo ?? '/'}>
      <LoginForm />
    </AuthGuard>
  )
}
```

### 4.5 错误提示国际化

前端表单不再直接显示 `data.error.message`，而是根据 `data.error.code` 映射本地化消息。

**`songs/new/page.tsx` 和 `lyrics/new/page.tsx`：**

```tsx
const errorMap: Record<string, string> = {
  UNAUTHORIZED: tCommon('errors.unauthorized'),
  VALIDATION_ERROR: tCommon('errors.validationError'),
}

setError(errorMap[data.error?.code] || tCommon('errors.createFailed'))
```

**`AlbumFormDialog.tsx`：**

将 `alert()` 改为弹窗内联错误提示，使用同样的 `errorMap` 映射。

**新增翻译键（zh.json / en.json）：**

```json
{
  "common": {
    "errors": {
      "unauthorized": "请先登录后再进行操作",
      "validationError": "请检查输入内容是否正确"
    }
  }
}
```

> 注：`zh.json` 当前存在未解决的 git merge conflict。新增翻译键时应避开冲突区域，仅追加新键。

## 5. 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/app/[locale]/songs/new/layout.tsx` | 新增 | Server layout auth guard |
| `apps/web/src/app/[locale]/lyrics/new/layout.tsx` | 新增 | Server layout auth guard |
| `apps/web/src/components/auth/auth-guard-button.tsx` | 新增 | 客户端按钮 auth 拦截 |
| `apps/web/src/app/[locale]/songs/page.tsx` | 修改 | 「新建」按钮改用 AuthGuardButton |
| `apps/web/src/app/[locale]/lyrics/page.tsx` | 修改 | 「新建」按钮改用 AuthGuardButton |
| `apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx` | 修改 | create 模式打开前检查 auth |
| `apps/web/src/app/actions/auth.ts` | 修改 | OAuth/Magic Link 支持 next |
| `apps/web/src/components/auth/oauth-buttons.tsx` | 修改 | 读取 redirectTo |
| `apps/web/src/components/auth/magic-link-form.tsx` | 修改 | 读取 redirectTo |
| `apps/web/src/app/[locale]/login/page.tsx` | 修改 | 传 redirectTo 给 AuthGuard |
| `apps/web/src/app/[locale]/songs/new/page.tsx` | 修改 | 错误提示国际化 |
| `apps/web/src/app/[locale]/lyrics/new/page.tsx` | 修改 | 错误提示国际化 |
| `apps/web/messages/zh.json` | 修改 | 新增翻译键 |
| `apps/web/messages/en.json` | 修改 | 新增翻译键 |

## 6. 测试计划

1. **未登录访问 `/songs/new`** — 应 redirect 到 `/login?redirectTo=/songs/new`
2. **未登录点击 songs 列表页「新建」** — 应跳转登录页，登录后返回 `/songs/new`
3. **未登录点击 lyrics 列表页「新建」** — 同上，返回 `/lyrics/new`
4. **未登录点击 albums 列表页「新建专辑」** — 弹窗不打开，跳转登录页，登录后返回 `/albums`
5. **已登录用户正常使用** — 所有创建入口不受影响
6. **OAuth/Magic Link 登录后返回** — 从创建入口跳转登录，使用 OAuth/Magic Link 后返回原意图页面
7. **错误提示** — 断开网络时显示中文网络错误
