# Issue #90: 登录页和注册页添加导航栏

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/login` 和 `/register` 页面添加与首页一致的导航栏，支持主题切换和语言切换

**Architecture:** 直接在页面组件中添加 `<SiteHeader />` 组件，无需创建新文件或修改路由结构

**Tech Stack:** Next.js App Router, next-intl, @kiyo/ui

---

## 文件清单

| 文件 | 操作 | 描述 |
|------|------|------|
| `apps/web/src/app/login/page.tsx` | Modify | 添加 `<SiteHeader />` 组件 |
| `apps/web/src/app/register/page.tsx` | Modify | 添加 `<SiteHeader />` 组件 |

---

## 实现计划

### Task 1: 修改登录页面添加导航栏

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`

- [ ] **Step 1: 导入 SiteHeader 组件**

在文件顶部的 import 语句区域，添加 SiteHeader 的导入：

```tsx
import { SiteHeader } from '@/components/site-header'
```

- [ ] **Step 2: 在页面中添加 SiteHeader**

在 `AuthGuard` 组件之前添加 `<SiteHeader />`：

```tsx
export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          ...
        </div>
      </AuthGuard>
    </>
  )
}
```

注意：需要用 Fragment (`<>...</>`) 包裹 SiteHeader 和 AuthGuard，因为这是单个组件的返回值。

- [ ] **Step 3: 运行类型检查**

Run: `pnpm --filter web type-check`
Expected: 无错误输出

- [ ] **Step 4: 提交更改**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add apps/web/src/app/login/page.tsx
git commit -m "feat(auth): add navbar to login page"
```

---

### Task 2: 修改注册页面添加导航栏

**Files:**
- Modify: `apps/web/src/app/register/page.tsx`

- [ ] **Step 1: 导入 SiteHeader 组件**

```tsx
import { SiteHeader } from '@/components/site-header'
```

- [ ] **Step 2: 在页面中添加 SiteHeader**

```tsx
export default async function RegisterPage() {
  const locale = await getLocale()

  return (
    <>
      <SiteHeader />
      <AuthGuard>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            ...
          </Card>
        </div>
      </AuthGuard>
    </>
  )
}
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm --filter web type-check`
Expected: 无错误输出

- [ ] **Step 4: 提交更改**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add apps/web/src/app/register/page.tsx
git commit -m "feat(auth): add navbar to register page"
```

---

### Task 3: 验证功能

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm --filter web dev`
Expected: 开发服务器启动成功

- [ ] **Step 2: 访问登录页验证导航栏**

访问: `http://localhost:3000/zh/login`
验证:
- 顶部显示导航栏（Logo + 导航链接 + 语言切换 + 主题切换）
- 导航栏样式与首页一致

- [ ] **Step 3: 访问注册页验证导航栏**

访问: `http://localhost:3000/en/register`
验证:
- 顶部显示导航栏
- 语言切换功能正常

- [ ] **Step 4: 测试主题切换**

点击主题切换按钮，验证浅色/深色模式切换正常

- [ ] **Step 5: 提交最终更改**

```bash
git push origin feat-90-login-register-navbar
```

---

## 自检清单

- [ ] 登录页面包含 `<SiteHeader />` 组件
- [ ] 注册页面包含 `<SiteHeader />` 组件
- [ ] 类型检查通过
- [ ] Git 提交已完成
- [ ] 功能验证通过（导航栏显示、主题切换、语言切换）