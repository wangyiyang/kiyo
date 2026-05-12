# OAuth 社交登录实现计划

**文件:** `docs/superpowers/plans/2026-05-12-oauth-login.md`  
**相关设计:** `docs/superpowers/specs/2026-05-12-oauth-login-design.md`  
**相关 Issue:** #126

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加 GitHub 和 Google OAuth 登录，绕过邮件 rate limit

**Architecture:** 在 auth actions 中添加 `signInWithOAuth`，创建 OAuth 按钮组件，在登录/注册页表单上方显示

**Tech Stack:** Supabase Auth, Next.js Server Actions, @kiyo/ui

---

## 文件结构

```
apps/web/src/
├── app/actions/auth.ts                    # 新增 signInWithOAuth
├── app/auth/callback/route.ts             # 确认回调处理
└── components/auth/
    ├── oauth-buttons.tsx                  # 新增: GitHub/Google 按钮
    ├── login-form.tsx                     # 修改: 添加 OAuth 按钮
    └── register-form.tsx                  # 修改: 添加 OAuth 按钮
```

---

### Task 1: 添加 signInWithOAuth Action

**文件:** `apps/web/src/app/actions/auth.ts`

- [ ] **Step 1: 添加 signInWithOAuth 函数**

在 `signOut` 函数后添加：

```typescript
export async function signInWithOAuth(provider: 'github' | 'google'): Promise<never> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error || !data.url) {
    throw new Error(error?.message ?? 'OAuth failed')
  }

  redirect(data.url)
}
```

- [ ] **Step 2: 验证代码**

运行: `pnpm --filter web type-check`  
预期: 无错误

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/app/actions/auth.ts
git commit -m "feat(auth): add signInWithOAuth action"
```

---

### Task 2: 创建 OAuth 按钮组件

**文件:** `apps/web/src/components/auth/oauth-buttons.tsx`

- [ ] **Step 1: 创建组件**

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { signInWithOAuth } from '@/app/actions/auth'
import { Button } from '@kiyo/ui'
import { Github, Chrome } from 'lucide-react'

export function OAuthButtons() {
  const t = useTranslations('auth')

  const handleGitHubSignIn = () => {
    signInWithOAuth('github')
  }

  const handleGoogleSignIn = () => {
    signInWithOAuth('google')
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignIn}
      >
        <Github className="mr-2 h-4 w-4" />
        {t('oauth.github')}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
      >
        <Chrome className="mr-2 h-4 w-4" />
        {t('oauth.google')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: 添加 i18n 翻译**

在 `apps/web/messages/zh.json` 和 `apps/web/messages/en.json` 添加：

```json
{
  "oauth": {
    "github": "使用 GitHub 登录",
    "google": "使用 Google 登录"
  }
}
```

英文版：

```json
{
  "oauth": {
    "github": "Continue with GitHub",
    "google": "Continue with Google"
  }
}
```

- [ ] **Step 3: 验证构建**

运行: `pnpm --filter web build`  
预期: 成功（可能需要先 `pnpm install` 获取 lucide-react）

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/auth/oauth-buttons.tsx apps/web/messages/
git commit -m "feat(auth): add OAuth buttons component"
```

---

### Task 3: 在登录页添加 OAuth

**文件:** `apps/web/src/components/auth/login-form.tsx`

- [ ] **Step 1: 导入组件并添加分隔线**

在文件顶部添加导入：
```typescript
import { Separator } from '@kiyo/ui'
import { OAuthButtons } from './oauth-buttons'
```

在 `return` 的 `<div className="space-y-4">` 开头添加：

```tsx
<div className="space-y-4">
  <OAuthButtons />
  <div className="flex items-center gap-3">
    <Separator className="flex-1" />
    <span className="text-xs text-muted-foreground">或</span>
    <Separator className="flex-1" />
  </div>
  {mode === 'password' ? (
    <>
      <PasswordLoginForm />
      ...
```

- [ ] **Step 2: 验证**

运行: `pnpm --filter web dev`  
预期: 登录页显示 OAuth 按钮

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/components/auth/login-form.tsx
git commit -m "feat(auth): add OAuth buttons to login page"
```

---

### Task 4: 在注册页添加 OAuth

**文件:** `apps/web/src/components/auth/register-form.tsx`

- [ ] **Step 1: 查看当前组件结构**

读取 `apps/web/src/components/auth/register-form.tsx`，找到表单容器添加 OAuth 按钮和分隔线（参考登录页的修改方式）

- [ ] **Step 2: 添加 OAuth 到注册页**

在注册表单容器开头添加：

```tsx
<div className="space-y-4">
  <OAuthButtons />
  <div className="flex items-center gap-3">
    <Separator className="flex-1" />
    <span className="text-xs text-muted-foreground">或</span>
    <Separator className="flex-1" />
  </div>
  {/* 原表单内容 */}
```

- [ ] **Step 3: 验证**

运行: `pnpm --filter web dev`  
预期: 注册页也显示 OAuth 按钮

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/auth/register-form.tsx
git commit -m "feat(auth): add OAuth buttons to register page"
```

---

### Task 5: 端到端测试

- [ ] **Step 1: 测试 GitHub 登录**

1. 打开 https://kiyo.wangyiyang.cc/login
2. 点击 GitHub 按钮
3. 确认跳转到 GitHub 授权页面
4. 授权后确认回调并登录成功

- [ ] **Step 2: 测试 Google 登录**

1. 打开 https://kiyo.wangyiyang.cc/login
2. 点击 Google 按钮
3. 确认跳转到 Google 授权页面
4. 授权后确认回调并登录成功

- [ ] **Step 3: 测试注册页 OAuth**

1. 打开 https://kiyo.wangyiyang.cc/register
2. 点击任意 OAuth 按钮
3. 确认新用户能成功创建账户并登录

---

## 成功标准

- [ ] GitHub OAuth 登录正常
- [ ] Google OAuth 登录正常
- [ ] 登录页和注册页都显示 OAuth 按钮
- [ ] 新用户 OAuth 登录后自动创建账户
- [ ] 现有用户 OAuth 登录（相同邮箱）直接登录
- [ ] 无 TypeScript 错误
- [ ] 构建成功

---

## 回滚计划

如有问题，逐一回滚 Task 1-4 的提交：
```bash
git revert <commit-hash>
```