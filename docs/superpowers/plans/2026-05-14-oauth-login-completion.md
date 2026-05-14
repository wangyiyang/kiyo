# OAuth 社交登录完善（Issue #126 收尾）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 OAuth 登录的代码健壮性优化、用户体验增强和配置文档补充。

**Architecture:** 在现有 OAuth 基础上修复边界情况（fallback URL、错误细分、加载态），并在登录页展示回调错误。文档层面补充环境变量注释和配置指南。

**Tech Stack:** Next.js 14, React, TypeScript, Supabase Auth, next-intl, Tailwind CSS, shadcn/ui

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `apps/web/src/app/actions/auth.ts` | 修改 | `signInWithOAuth` fallback URL + JSDoc |
| `apps/web/src/app/auth/callback/route.ts` | 修改 | 细分 OAuth 回调错误码 + 服务端日志 |
| `apps/web/src/components/auth/oauth-buttons.tsx` | 修改 | `useTransition` 加载态 + `aria-busy` |
| `apps/web/src/components/auth/login-form.tsx` | 修改 | 读取 `?error=` 并展示对应提示 |
| `apps/web/messages/zh.json` | 修改 | 新增 `auth.errors.oauthMissingCode` / `oauthExchangeFailed` |
| `apps/web/messages/en.json` | 修改 | 同上英文翻译 |
| `apps/web/.env.local.example` | 修改 | 补充 OAuth 环境变量注释 |
| `README.md` | 修改 | 新增 OAuth 社交登录章节 |
| `docs/oauth-setup.md` | 新建 | GitHub + Google OAuth 详细配置指南 |

---

### Task 1: 修复 `signInWithOAuth` 的 `NEXT_PUBLIC_SITE_URL` fallback

**Files:**
- Modify: `apps/web/src/app/actions/auth.ts`

- [ ] **Step 1: 修改 `signInWithOAuth` 函数**

将 `process.env.NEXT_PUBLIC_SITE_URL` 替换为 `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'`，并添加 JSDoc。

```typescript
/**
 * 发起 OAuth 登录流程，直接重定向到 Provider 授权页。
 * 注意：此函数通过 `redirect()` 跳转，不会正常返回。
 */
export async function signInWithOAuth(
  provider: 'github' | 'google',
  next?: string
): Promise<never> {
  const supabase = await createServerClient()
  const baseRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`
  const redirectTo = next
    ? `${baseRedirectTo}?next=${encodeURIComponent(next)}`
    : baseRedirectTo
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })

  if (error || !data.url) {
    throw new Error(error?.message ?? 'OAuth failed')
  }

  redirect(data.url)
}
```

- [ ] **Step 2: 类型检查确认无编译错误**

Run: `pnpm --filter web type-check`
Expected: 无与 `auth.ts` 相关的类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/actions/auth.ts
git commit -m "fix(auth): add NEXT_PUBLIC_SITE_URL fallback in signInWithOAuth"
```

---

### Task 2: 优化 OAuth callback route 错误处理

**Files:**
- Modify: `apps/web/src/app/auth/callback/route.ts`

- [ ] **Step 1: 替换 route.ts 完整内容**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@kiyo/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    console.error('[OAuth Callback] Missing authorization code')
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[OAuth Callback] Exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/callback/route.ts
git commit -m "fix(auth): differentiate OAuth callback error codes and add server logs"
```

---

### Task 3: OAuth 按钮添加 pending 加载态与可访问性

**Files:**
- Modify: `apps/web/src/components/auth/oauth-buttons.tsx`

- [ ] **Step 1: 修改组件为 `useTransition` 版本**

```typescript
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { signInWithOAuth } from '@/app/actions/auth'
import { Button } from '@kiyo/ui'
import { Github, Chrome } from 'lucide-react'

export function OAuthButtons() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? undefined
  const [isPending, startTransition] = React.useTransition()

  const handleGitHubSignIn = () => {
    startTransition(() => {
      signInWithOAuth('github', redirectTo)
    })
  }

  const handleGoogleSignIn = () => {
    startTransition(() => {
      signInWithOAuth('google', redirectTo)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignIn}
        disabled={isPending}
        aria-busy={isPending}
      >
        <Github className="mr-2 h-4 w-4" />
        {t('oauth.github')}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
        disabled={isPending}
        aria-busy={isPending}
      >
        <Chrome className="mr-2 h-4 w-4" />
        {t('oauth.google')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/oauth-buttons.tsx
git commit -m "feat(auth): add pending state and aria-busy to OAuth buttons"
```

---

### Task 4: 登录表单展示 OAuth 回调错误

**Files:**
- Modify: `apps/web/src/components/auth/login-form.tsx`

- [ ] **Step 1: 添加 `useSearchParams` import 和错误映射**

在 `login-form.tsx` 顶部添加 import：

```typescript
import { useSearchParams } from 'next/navigation'
```

在 `LoginForm` 函数体内，紧接 `const t = useTranslations('auth')` 之后添加：

```typescript
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  const oauthErrorMessage = oauthError
    ? oauthError === 'missing_code'
      ? t('errors.oauthMissingCode')
      : oauthError === 'oauth_exchange_failed'
        ? t('errors.oauthExchangeFailed')
        : null
    : null
```

- [ ] **Step 2: 在 OAuth 按钮上方插入错误提示**

在 `return` 的 JSX 中，在 `<div className="space-y-4">` 内的 `<OAuthButtons />` 之前插入：

```tsx
      {oauthErrorMessage && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {oauthErrorMessage}
        </div>
      )}
```

完整修改后 `<div className="space-y-4">` 内部开头应如下：

```tsx
    <div className="space-y-4">
      {oauthErrorMessage && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {oauthErrorMessage}
        </div>
      )}
      <OAuthButtons />
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter web type-check`
Expected: 无错误（注意 `useSearchParams` 已在客户端组件中可用）

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/login-form.tsx
git commit -m "feat(auth): display OAuth callback errors on login page"
```

---

### Task 5: 添加 OAuth 错误国际化翻译键

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 zh.json**

在 `apps/web/messages/zh.json` 的 `"auth" > "errors"` 对象中，在 `"termsRequired"` 之后添加：

```json
      "oauthMissingCode": "授权失败，请重试",
      "oauthExchangeFailed": "登录验证失败，请检查配置或稍后重试"
```

- [ ] **Step 2: 修改 en.json**

在 `apps/web/messages/en.json` 的 `"auth" > "errors"` 对象中，在 `"termsRequired"` 之后添加：

```json
      "oauthMissingCode": "Authorization failed. Please try again.",
      "oauthExchangeFailed": "Login verification failed. Please check configuration or try again later."
```

- [ ] **Step 3: 验证 JSON 格式**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/zh.json'))" && echo "zh.json valid"
node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en.json'))" && echo "en.json valid"
```
Expected: 两行均输出 valid

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add OAuth callback error messages"
```

---

### Task 6: 补充环境变量示例注释

**Files:**
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: 在 Supabase 配置上方插入 OAuth 注释**

在文件开头（或 Supabase 区块之前）插入：

```bash
# OAuth 社交登录
# 需在 Supabase Dashboard > Authentication > Providers 中开启对应 Provider
# GitHub: https://supabase.com/docs/guides/auth/social-login/auth-github
# Google: https://supabase.com/docs/guides/auth/social-login/auth-google
NEXT_PUBLIC_SITE_URL=https://kiyo.wangyiyang.cc
```

注意：如果文件中已有 `NEXT_PUBLIC_SITE_URL`，避免重复，改为在其上方添加注释块。

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.local.example
git commit -m "docs(env): add OAuth setup comments to .env.local.example"
```

---

### Task 7: README.md 新增 OAuth 章节

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 在 README 中合适位置插入 OAuth 章节**

在 "本地开发" 或 "部署" 附近（或文档末尾）新增：

```markdown
## OAuth 社交登录

本项目支持 GitHub 和 Google OAuth 登录。详细配置步骤请参阅 [docs/oauth-setup.md](docs/oauth-setup.md)。

环境要求：
- `NEXT_PUBLIC_SITE_URL` 必须设置为实际域名（本地开发用 `http://localhost:3000`）
- Supabase Dashboard 中已开启对应 Provider 并填写 Client ID / Secret
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): add OAuth social login section"
```

---

### Task 8: 新建 `docs/oauth-setup.md` 配置指南

**Files:**
- Create: `docs/oauth-setup.md`

- [ ] **Step 1: 创建文件**

```markdown
# OAuth 社交登录配置指南

本文档说明如何在 Kiyo 项目中配置 GitHub 和 Google OAuth 登录。

## 前置条件

- 已创建 Supabase 项目
- 已设置 `NEXT_PUBLIC_SITE_URL` 环境变量

## 通用准备

1. 确认 `NEXT_PUBLIC_SITE_URL` 的值：
   - 本地开发：`http://localhost:3000`
   - 生产环境：`https://kiyo.wangyiyang.cc`
2. Supabase Auth 回调路径固定为：`/auth/callback`

## GitHub OAuth App 配置

1. 打开 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. 填写应用信息：
   - **Application name**: Kiyo（或你喜欢的名称）
   - **Homepage URL**: `https://kiyo.wangyiyang.cc`
   - **Authorization callback URL**: `https://kiyo.wangyiyang.cc/auth/callback`
3. 创建后复制 **Client ID** 和 **Client Secret**
4. 打开 Supabase Dashboard → Authentication → Providers → GitHub
5. 启用 GitHub 并粘贴 Client ID 和 Client Secret
6. 保存

## Google Cloud Console 配置

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. 点击 **Create Credentials** → **OAuth 2.0 Client ID**
3. 选择应用类型为 **Web application**
4. 填写名称（如 "Kiyo OAuth"）
5. 在 **Authorized redirect URIs** 中添加：
   ```
   https://<你的项目>.supabase.co/auth/v1/callback
   ```
   ‼️ 注意：这是 Supabase 的回调地址，不是前端地址。请替换 `<你的项目>` 为实际 Supabase Project Reference ID。
6. 创建后复制 **Client ID** 和 **Client Secret**
7. 打开 Supabase Dashboard → Authentication → Providers → Google
8. 启用 Google 并粘贴 Client ID 和 Client Secret
9. 保存

## 本地开发 vs 生产环境

| 环境 | NEXT_PUBLIC_SITE_URL | GitHub callback URL | Google redirect URI |
|---|---|---|---|
| 本地 | `http://localhost:3000` | `http://localhost:3000/auth/callback` | Supabase 地址不变 |
| 生产 | `https://kiyo.wangyiyang.cc` | `https://kiyo.wangyiyang.cc/auth/callback` | Supabase 地址不变 |

ℹ️ Google 的 redirect URI 始终指向 Supabase 服务端地址，不受前端域名影响。

GitHub 的 callback URL 需与前端域名一致，因此本地开发和生产需要分别配置，或在 GitHub OAuth App 中同时添加两个 callback URL。

## 验证

配置完成后：
1. 启动本地开发服务器：`pnpm --filter web dev`
2. 访问 `http://localhost:3000/login`
3. 点击 GitHub 或 Google 登录按钮
4. 完成授权后应成功登录并跳转回首页

## 常见问题

- **跳转地址错误**：检查 `NEXT_PUBLIC_SITE_URL` 是否设置正确
- **Provider 未启用**：确认 Supabase Dashboard 中对应 Provider 已开启
- **Callback 失败**：检查浏览器地址栏的 `?error=` 参数，或查看服务端日志
```

- [ ] **Step 2: Commit**

```bash
git add docs/oauth-setup.md
git commit -m "docs: add OAuth setup guide for GitHub and Google"
```

---

## 自检

**1. Spec coverage:**
- [x] auth.ts fallback 修复 → Task 1
- [x] callback route 错误细分 + 日志 → Task 2
- [x] oauth-buttons pending + aria-busy → Task 3
- [x] login-form 错误展示 → Task 4
- [x] 国际化翻译键 → Task 5
- [x] .env.local.example 注释 → Task 6
- [x] README.md OAuth 章节 → Task 7
- [x] docs/oauth-setup.md 配置指南 → Task 8
- [x] middleware 兼容性已验证（spec 结论：无需修改）

**2. Placeholder scan:**
- 无 TBD、TODO、"implement later" 或 "add appropriate error handling" 等模糊描述
- 每个代码步骤均包含完整代码块
- 每个命令步骤均包含预期输出

**3. Type consistency:**
- `signInWithOAuth` 签名保持 `Promise<never>`，与 spec 一致
- `provider` 类型保持 `'github' | 'google'`
- `next` 参数类型保持 `string | undefined`
- 翻译键路径 `auth.errors.oauthMissingCode` / `auth.errors.oauthExchangeFailed` 在 Task 4 和 Task 5 中一致

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2026-05-14-oauth-login-completion.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
