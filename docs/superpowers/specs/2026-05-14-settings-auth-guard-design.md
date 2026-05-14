# 设置页认证守卫修复与统一认证方案

## 背景

- **Issue**: [#160](https://github.com/wangyiyang/kiyo/issues/160) — 侧边栏「设置」入口不可达，直接访问 `/settings` 会回到首页。
- **根因**: `/settings/page.tsx` 错误地使用了 `<AuthGuard>` 组件。该组件的功能是**阻止已登录用户访问**（用于登录/注册等页面），当检测到用户已登录时会 `redirect('/')`，导致已登录用户反而无法进入设置页。
- **当前现状**: 项目中其他需要登录的页面（dashboard、songs/new、lyrics/new 等）各自手写 `if (!user) redirect('/login')`，模式不统一。

## 设计目标

1. 修复 `/settings` 入口不可达问题。
2. 统一项目中「需要登录」页面的认证守卫方式，消除 `AuthGuard` 的命名误导。
3. 对 `'use client'` 页面也提供认证保护（通过新增 Server Layout）。
4. 保持改动最小化，不引入额外的运行时依赖。

## 组件设计

### RequireAuth — 正向认证守卫（Server Component）

新建文件：`apps/web/src/components/auth/require-auth.tsx`

```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

interface RequireAuthProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function RequireAuth({ children, redirectTo = '/login' }: RequireAuthProps) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(redirectTo)
  }

  return <>{children}</>
}
```

- 这是一个 **async Server Component**，直接复用项目中已有的 `createServerClient` 模式。
- `redirectTo` 默认值为 `/login`，支持传入带 `redirectTo` 查询参数的路径（如 `/login?redirectTo=/songs/new`）。

### GuestGuard — 反向访客守卫（重命名 AuthGuard）

将现有 `apps/web/src/components/auth/auth-guard.tsx` 重命名为 `guest-guard.tsx`，导出 `GuestGuard`。

功能不变：检测到已登录用户时 `redirect(redirectTo)`，用于登录/注册/找回密码等页面。

## 修改范围

### A. 核心修复（issue #160）

**文件**: `apps/web/src/app/[locale]/settings/page.tsx`

- 移除反向的 `<AuthGuard>` 包裹。
- 在页面内容外层包裹 `<RequireAuth>`。

### B. Server 页面统一（替换现有 `!user` 守卫）

以下页面当前在 page/layout 内手写 `if (!user) redirect(...)`，统一替换为 `<RequireAuth>` 包裹：

| 文件 | 当前模式 | 替换方式 |
|---|---|---|
| `dashboard/page.tsx` | page 内 `!user` → `redirect('/login')` | page 内容包裹 `<RequireAuth>` |
| `songs/new/layout.tsx` | layout 内 `!user` → `redirect('/login?redirectTo=/songs/new')` | layout 包裹 `<RequireAuth redirectTo="/login?redirectTo=/songs/new">` |
| `lyrics/new/layout.tsx` | layout 内 `!user` → `redirect('/login?redirectTo=/lyrics/new')` | layout 包裹 `<RequireAuth redirectTo="/login?redirectTo=/lyrics/new">` |
| `lyrics/[id]/page.tsx` | page 内 `!user` → `redirect('/login')` | page 内容包裹 `<RequireAuth>` |
| `albums/[id]/page.tsx` | page 内 `!user` → `redirect('/login')` | page 内容包裹 `<RequireAuth>` |
| `songs/[id]/page.tsx` | page 内 `!user` → `redirect('/login')` | page 内容包裹 `<RequireAuth>` |

### C. Client 页面通过 Server Layout 统一

以下页面是 `'use client'`，无法直接在 page 内使用 Server Component。为它们新增 Server Layout：

| 页面 | 新增 Layout 文件 | Layout 内容 |
|---|---|---|
| `lyrics/[id]/edit/page.tsx` | `lyrics/[id]/edit/layout.tsx` | `<RequireAuth>{children}</RequireAuth>` |
| `songs/[id]/edit/page.tsx` | `songs/[id]/edit/layout.tsx` | `<RequireAuth>{children}</RequireAuth>` |
| `songs/cover/page.tsx` | `songs/cover/layout.tsx` | `<RequireAuth>{children}</RequireAuth>` |

### D. AuthGuard → GuestGuard 重命名

- 重命名 `components/auth/auth-guard.tsx` → `components/auth/guest-guard.tsx`，导出 `GuestGuard`。
- 更新以下页面的引用：
  - `login/page.tsx`
  - `register/page.tsx`
  - `forgot-password/page.tsx`

### E. 删除 auth-guard.tsx

重命名完成后，原 `auth-guard.tsx` 不再存在。若其他文件有引用（如 `auth-guard-button.test.tsx` 等），需同步检查更新。

## 数据流与边界情况

### 防御性检查保留策略

`dashboard/page.tsx` 中的 `getStats()` 和 `getRecentItems()` 内部有 `if (!user) return null/[]`。这些检查在 `<RequireAuth>` 生效后理论上永远不会触发。

**决策**: 保留这些防御性检查，因为数据获取函数与页面渲染是独立单元。移除它们需要额外验证，而保留不会带来副作用。

### 重定向行为

- 未登录用户访问受保护页面 → `redirect('/login')` → Next.js 服务端重定向 → 浏览器加载登录页。
- `/songs/new` 和 `/lyrics/new` 保留 `redirectTo` 参数，登录后通过登录表单逻辑自动回到原页面。

## 测试策略

- **类型检查**: `pnpm type-check` — 确保 `RequireAuth` 的 async Server Component 类型正确。
- **构建检查**: `pnpm build` — 确保无运行时问题（尤其是 `'use client'` 页面 + Server Layout 的组合）。
- **功能验证**:
  - 已登录用户点击侧边栏「设置」→ 正常进入设置页。
  - 直接访问 `/settings` → 正常显示。
  - 未登录用户直接访问 `/settings` → 重定向到 `/login`。
  - 未登录用户访问 `/songs/new` → 重定向到 `/login?redirectTo=/songs/new`。
  - 登录/注册/找回密码页面在已登录状态下 → 重定向到首页（`GuestGuard` 原有行为）。

## 风险与回滚

- **风险**: `RequireAuth` 是新增 Server Component，若 `'use client'` 页面与 Server Layout 组合出现运行时异常，可能影响编辑页和翻唱页。
- **缓解**: 这些页面当前完全没有认证守卫（`lyrics/[id]/edit`、`songs/[id]/edit` 甚至没有 `!user` 检查），新增 layout 只会增加保护，不会破坏已有功能。
- **回滚**: 若出现严重问题，可回滚单个 commit，恢复原有手动守卫代码。
