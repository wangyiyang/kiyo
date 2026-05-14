# Issue #195 导航统一重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过 Next.js Route Group 重构，为静态页面添加顶部导航、移除设置页导航重复、增强 404 页面。

**Architecture:** 将页面按导航模式分为 `(site)`（顶部导航）和 `(dashboard)`（侧边栏导航）两个 Route Group。URL 保持不变，布局由 group-level layout 统一提供，页面内移除内联的 `SiteHeader`/`SiteFooter`。

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, next-intl, shadcn/ui

---

## 文件变更概览

### 新建文件（5 个）
- `apps/web/src/app/[locale]/(site)/layout.tsx` — 顶部导航布局
- `apps/web/src/app/[locale]/(site)/not-found.tsx` — 增强版 404（带顶部导航）
- `apps/web/src/app/[locale]/(dashboard)/layout.tsx` — 侧边栏导航布局
- `apps/web/src/app/[locale]/(dashboard)/not-found.tsx` — 增强版 404（带侧边栏）

### 删除文件（4 个）
- `apps/web/src/app/[locale]/songs/layout.tsx`
- `apps/web/src/app/[locale]/albums/layout.tsx`
- `apps/web/src/app/[locale]/lyrics/layout.tsx`
- `apps/web/src/app/[locale]/settings/layout.tsx`

### 移动文件（保留 git history）
- `apps/web/src/app/[locale]/page.tsx` → `apps/web/src/app/[locale]/(site)/page.tsx`
- `apps/web/src/app/[locale]/explore/` → `apps/web/src/app/[locale]/(site)/explore/`
- `apps/web/src/app/[locale]/contact/` → `apps/web/src/app/[locale]/(site)/contact/`
- `apps/web/src/app/[locale]/privacy/` → `apps/web/src/app/[locale]/(site)/privacy/`
- `apps/web/src/app/[locale]/terms/` → `apps/web/src/app/[locale]/(site)/terms/`
- `apps/web/src/app/[locale]/login/` → `apps/web/src/app/[locale]/(site)/login/`
- `apps/web/src/app/[locale]/register/` → `apps/web/src/app/[locale]/(site)/register/`
- `apps/web/src/app/[locale]/forgot-password/` → `apps/web/src/app/[locale]/(site)/forgot-password/`
- `apps/web/src/app/[locale]/reset-password/` → `apps/web/src/app/[locale]/(site)/reset-password/`
- `apps/web/src/app/[locale]/dashboard/` → `apps/web/src/app/[locale]/(dashboard)/dashboard/`
- `apps/web/src/app/[locale]/songs/` → `apps/web/src/app/[locale]/(dashboard)/songs/`
- `apps/web/src/app/[locale]/albums/` → `apps/web/src/app/[locale]/(dashboard)/albums/`
- `apps/web/src/app/[locale]/lyrics/` → `apps/web/src/app/[locale]/(dashboard)/lyrics/`
- `apps/web/src/app/[locale]/settings/` → `apps/web/src/app/[locale]/(dashboard)/settings/`

### 修改文件（页面内清理内联导航 + i18n）
- `apps/web/src/app/[locale]/(site)/page.tsx` — 移除 `SiteHeader`、`SiteFooter`
- `apps/web/src/app/[locale]/(site)/explore/page.tsx` — 移除 `SiteHeader`、`SiteFooter`
- `apps/web/src/app/[locale]/(site)/login/page.tsx` — 移除 `SiteHeader`
- `apps/web/src/app/[locale]/(site)/register/page.tsx` — 移除 `SiteHeader`
- `apps/web/src/app/[locale]/(dashboard)/dashboard/page.tsx` — 移除 `SiteHeader`、`SiteFooter`
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` — 移除 `SiteHeader`
- `apps/web/messages/zh.json` — 添加 `notFound.backToHome`
- `apps/web/messages/en.json` — 添加 `notFound.backToHome`

---

## Task 1: 创建 Route Group 目录结构

**Files:**
- Create directories (no files yet)

- [ ] **Step 1: 创建 Route Group 目录**

```bash
cd apps/web/src/app/[locale]
mkdir -p (site)/{explore,contact,privacy,terms,login,register,forgot-password,reset-password}
mkdir -p (dashboard)/{dashboard,songs,albums,lyrics,settings}
```

- [ ] **Step 2: 确认目录创建成功**

```bash
ls -d (site) (dashboard)
ls (site)/
ls (dashboard)/
```

- [ ] **Step 3: Commit**

```bash
git add -N apps/web/src/app/\[locale\]/\(site\)/ apps/web/src/app/\[locale\]/\(dashboard\)/
git commit -m "chore: create route group directories for navigation unification"
```

---

## Task 2: 移动公共展示型页面到 `(site)` 组

**Files:**
- Move: `apps/web/src/app/[locale]/page.tsx`
- Move: `apps/web/src/app/[locale]/explore/` → `(site)/explore/`
- Move: `apps/web/src/app/[locale]/contact/` → `(site)/contact/`
- Move: `apps/web/src/app/[locale]/privacy/` → `(site)/privacy/`
- Move: `apps/web/src/app/[locale]/terms/` → `(site)/terms/`
- Move: `apps/web/src/app/[locale]/login/` → `(site)/login/`
- Move: `apps/web/src/app/[locale]/register/` → `(site)/register/`
- Move: `apps/web/src/app/[locale]/forgot-password/` → `(site)/forgot-password/`
- Move: `apps/web/src/app/[locale]/reset-password/` → `(site)/reset-password/`

- [ ] **Step 1: 使用 git mv 移动所有 (site) 页面**

```bash
cd apps/web/src/app/[locale]
git mv page.tsx (site)/page.tsx
git mv explore (site)/explore
git mv contact (site)/contact
git mv privacy (site)/privacy
git mv terms (site)/terms
git mv login (site)/login
git mv register (site)/register
git mv forgot-password (site)/forgot-password
git mv reset-password (site)/reset-password
```

- [ ] **Step 2: 确认移动成功**

```bash
ls (site)/
# 应显示: explore/ contact/ privacy/ terms/ login/ register/ forgot-password/ reset-password/ page.tsx
git status
# 应显示 rename 操作，无 untracked 文件
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(site): move public pages into (site) route group"
```

---

## Task 3: 移动创作管理型页面到 `(dashboard)` 组

**Files:**
- Move: `apps/web/src/app/[locale]/dashboard/` → `(dashboard)/dashboard/`
- Move: `apps/web/src/app/[locale]/songs/` → `(dashboard)/songs/`
- Move: `apps/web/src/app/[locale]/albums/` → `(dashboard)/albums/`
- Move: `apps/web/src/app/[locale]/lyrics/` → `(dashboard)/lyrics/`
- Move: `apps/web/src/app/[locale]/settings/` → `(dashboard)/settings/`

- [ ] **Step 1: 使用 git mv 移动所有 (dashboard) 页面**

```bash
cd apps/web/src/app/[locale]
git mv dashboard (dashboard)/dashboard
git mv songs (dashboard)/songs
git mv albums (dashboard)/albums
git mv lyrics (dashboard)/lyrics
git mv settings (dashboard)/settings
```

- [ ] **Step 2: 确认移动成功**

```bash
ls (dashboard)/
# 应显示: dashboard/ songs/ albums/ lyrics/ settings/
git status
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(dashboard): move workspace pages into (dashboard) route group"
```

---

## Task 4: 删除冗余的 DashboardSidebar 子 layout

**Files:**
- Delete: `apps/web/src/app/[locale]/(dashboard)/songs/layout.tsx`
- Delete: `apps/web/src/app/[locale]/(dashboard)/albums/layout.tsx`
- Delete: `apps/web/src/app/[locale]/(dashboard)/lyrics/layout.tsx`
- Delete: `apps/web/src/app/[locale]/(dashboard)/settings/layout.tsx`

- [ ] **Step 1: 删除冗余 layout 文件**

```bash
cd apps/web/src/app/[locale]
git rm (dashboard)/songs/layout.tsx
git rm (dashboard)/albums/layout.tsx
git rm (dashboard)/lyrics/layout.tsx
git rm (dashboard)/settings/layout.tsx
```

- [ ] **Step 2: 确认删除**

```bash
git status
# 应显示 4 个 deleted 文件
```

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(dashboard): remove redundant sub-layouts, use group-level sidebar"
```

---

## Task 5: 创建 `(site)/layout.tsx`

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/layout.tsx`

- [ ] **Step 1: 编写 (site) 布局文件**

```tsx
import { SiteHeader } from '@/components/site-header'

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/layout.tsx
git commit -m "feat(site): add route group layout with SiteHeader"
```

---

## Task 6: 创建 `(dashboard)/layout.tsx`

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/layout.tsx`

- [ ] **Step 1: 编写 (dashboard) 布局文件**

```tsx
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardSidebar>{children}</DashboardSidebar>
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/layout.tsx
git commit -m "feat(dashboard): add route group layout with DashboardSidebar"
```

---

## Task 7: 清理页面中内联的 SiteHeader 和 SiteFooter

### 7a: 清理首页 `(site)/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/page.tsx`

移除 `SiteHeader` 和 `SiteFooter` 的 import 和 JSX 使用。

当前文件中的相关代码：
```tsx
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
```

以及 JSX 中的：
```tsx
<SiteHeader />
...
<SiteFooter />
```

- [ ] **Step 1: 移除 import**

将这两行从 imports 中删除：
```
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
```

- [ ] **Step 2: 移除 JSX**

将 `<SiteHeader />` 和 `<SiteFooter />` 从 return 语句中移除，保留其他内容不变。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/page.tsx
git commit -m "refactor(home): remove inline SiteHeader/SiteFooter, use group layout"
```

### 7b: 清理探索页 `(site)/explore/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/explore/page.tsx`

移除 `SiteHeader` 和 `SiteFooter` 的 import 和 JSX。

- [ ] **Step 1: 移除 import**

删除：
```
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
```

- [ ] **Step 2: 移除 JSX**

删除组件中的 `<SiteHeader />` 和 `<SiteFooter />` 调用。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/explore/page.tsx
git commit -m "refactor(explore): remove inline SiteHeader/SiteFooter, use group layout"
```

### 7c: 清理登录页 `(site)/login/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/login/page.tsx`

- [ ] **Step 1: 移除 import**

删除：
```
import { SiteHeader } from '@/components/site-header'
```

- [ ] **Step 2: 移除 JSX**

删除 `<SiteHeader />` 调用。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/login/page.tsx
git commit -m "refactor(login): remove inline SiteHeader, use group layout"
```

### 7d: 清理注册页 `(site)/register/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/register/page.tsx`

- [ ] **Step 1: 移除 import**

删除：
```
import { SiteHeader } from '@/components/site-header'
```

- [ ] **Step 2: 移除 JSX**

删除 `<SiteHeader />` 调用。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/register/page.tsx
git commit -m "refactor(register): remove inline SiteHeader, use group layout"
```

### 7e: 清理仪表板页 `(dashboard)/dashboard/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: 移除 import**

删除：
```
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
```

- [ ] **Step 2: 移除 JSX**

删除 `<SiteHeader />` 和 `<SiteFooter />` 调用，以及外层包裹的 `<div className="flex min-h-screen flex-col bg-background">` 和 `<main>` 标签（如果它们只是为了容纳 header/footer 而存在）。注意保留 `<RequireAuth>` 和 `<DashboardContent>` 的逻辑。

当前结构大致为：
```tsx
return (
  <div className="flex min-h-screen flex-col bg-background">
    <SiteHeader />
    <main className="flex-1">...</main>
    <SiteFooter />
  </div>
)
```

应简化为：
```tsx
return (
  <div className="container mx-auto px-4 py-8">
    ...
  </div>
)
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/dashboard/page.tsx
git commit -m "refactor(dashboard): remove inline SiteHeader/SiteFooter, use group layout"
```

### 7f: 清理设置页 `(dashboard)/settings/page.tsx`

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx`

- [ ] **Step 1: 移除 import**

删除：
```
import { SiteHeader } from '@/components/site-header'
```

- [ ] **Step 2: 移除 JSX**

删除 `<SiteHeader />` 调用。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/settings/page.tsx
git commit -m "refactor(settings): remove inline SiteHeader, use group layout"
```

---

## Task 8: 创建增强版 404 页面

### 8a: `(site)/not-found.tsx`

**Files:**
- Create: `apps/web/src/app/[locale]/(site)/not-found.tsx`

- [ ] **Step 1: 编写增强版 404**

```tsx
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Home } from 'lucide-react'
import { Button } from '@kiyo/ui'

export default function NotFoundPage() {
  const t = useTranslations('notFound')

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
      <Button asChild className="mt-8">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" />
          {t('backToHome')}
        </Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(site\)/not-found.tsx
git commit -m "feat(site): add enhanced 404 with back-to-home link"
```

### 8b: `(dashboard)/not-found.tsx`

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/not-found.tsx`

- [ ] **Step 1: 编写增强版 404（带侧边栏上下文）**

```tsx
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Home } from 'lucide-react'
import { Button } from '@kiyo/ui'

export default function NotFoundPage() {
  const t = useTranslations('notFound')

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
      <Button asChild className="mt-8">
        <Link href="/">
          <Home className="mr-2 h-4 w-4" />
          {t('backToHome')}
        </Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/not-found.tsx
git commit -m "feat(dashboard): add enhanced 404 with back-to-home link"
```

---

## Task 9: 添加 i18n 翻译键

### 9a: 中文翻译

**Files:**
- Modify: `apps/web/messages/zh.json`

在 `notFound` 对象内添加 `backToHome`：

当前 `notFound` 结构：
```json
"notFound": {
  "title": "页面未找到",
  "description": "您访问的页面不存在。"
}
```

- [ ] **Step 1: 添加 backToHome 键**

```json
"notFound": {
  "title": "页面未找到",
  "description": "您访问的页面不存在。",
  "backToHome": "返回首页"
}
```

### 9b: 英文翻译

**Files:**
- Modify: `apps/web/messages/en.json`

当前 `notFound` 结构：
```json
"notFound": {
  "title": "Page Not Found",
  "description": "The page you are looking for does not exist."
}
```

- [ ] **Step 1: 添加 backToHome 键**

```json
"notFound": {
  "title": "Page Not Found",
  "description": "The page you are looking for does not exist.",
  "backToHome": "Back to home"
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "i18n(notFound): add backToHome translation key"
```

---

## Task 10: 清理旧的 `not-found.tsx`

**Files:**
- Delete: `apps/web/src/app/[locale]/not-found.tsx`（已被移到 `(site)/not-found.tsx`，但旧文件在移动目录时已经被 git 跟踪了。等等，原 `not-found.tsx` 在 `[locale]/` 根下，它没有被移动。需要确认是否还需要它。）

等等——原 `not-found.tsx` 位于 `apps/web/src/app/[locale]/not-found.tsx`，它**没有被移动**到任何子目录。由于我们创建了 `(site)/not-found.tsx` 和 `(dashboard)/not-found.tsx`，旧的根级别 `not-found.tsx` 仍然会在 fallback 时使用。

Next.js 的 not-found 匹配规则：子路由的 `not-found.tsx` 优先。因此旧的根 `not-found.tsx` 可以作为兜底。但如果要统一清理，可以考虑删除它，让根 layout 的 fallback 使用子 group 的 not-found。

但实际上，根 `[locale]/not-found.tsx` 仍然有效。如果要完全统一，可以删除旧的简陋版本。但为安全起见，计划保留旧的根 `not-found.tsx` 作为 fallback，只确保新的 group-level 404 正常工作即可。

**决定：保留旧 `not-found.tsx` 作为兜底。**

---

## Task 11: 验证与测试

### 11a: TypeScript 类型检查

- [ ] **Step 1: 运行类型检查**

```bash
pnpm type-check
```

**期望结果**: 无类型错误。特别关注：
- `SiteHeader`/`SiteFooter` 被移除后，不再 import 未使用的模块
- 移动后的文件路径正确，无 "Cannot find module" 错误
- `not-found.tsx` 中的 `useTranslations('notFound')` 能解析到正确的类型

### 11b: ESLint 检查

- [ ] **Step 2: 运行 lint**

```bash
pnpm lint
```

**期望结果**: 无 lint 错误。特别关注未使用变量（已移除的 import）。

### 11c: 构建测试

- [ ] **Step 3: 运行生产构建**

```bash
pnpm build --filter web
```

**期望结果**: 构建成功，无路由冲突错误。

### 11d: 功能验证清单

- [ ] **Step 4: 手动验证导航一致性**

启动开发服务器：
```bash
pnpm --filter web dev
```

逐一检查：
- [ ] `/privacy` — 显示 `SiteHeader`，包含 Logo、导航链接、LocaleSwitcher、ThemeToggle、UserMenu
- [ ] `/terms` — 显示 `SiteHeader`
- [ ] `/contact` — 显示 `SiteHeader`
- [ ] `/settings` — 仅显示 `DashboardSidebar`，**无**重复顶部导航
- [ ] `/songs` — 正常显示 `DashboardSidebar`
- [ ] `/albums` — 正常显示 `DashboardSidebar`
- [ ] `/lyrics` — 正常显示 `DashboardSidebar`
- [ ] `/dashboard` — 正常显示 `DashboardSidebar`，无重复顶部导航
- [ ] `/` — `SiteHeader` 正常工作（滚动时样式变化）
- [ ] `/explore` — `SiteHeader` + 歌曲网格正常
- [ ] `/login` — `SiteHeader` 正常
- [ ] `/register` — `SiteHeader` 正常

### 11e: 404 验证

- [ ] **Step 5: 验证 404 页面**

- [ ] 访问 `/zh/nonexistent-page` — 显示 404，有"返回首页"按钮，顶部有导航栏
- [ ] 访问 `/en/nonexistent-page` — 显示 404，有"Back to home"按钮
- [ ] 访问 `/zh/songs/nonexistent` — 显示 404，有"返回首页"按钮，左侧有侧边栏

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "test: verify navigation unification passes all checks"
```

---

## Self-Review Checklist

### Spec Coverage
- [x] 隐私政策、用户协议、联系页面添加顶部导航 → Task 2 + Task 5
- [x] 404 页面增强 → Task 8 + Task 9
- [x] 设置页面移除重复导航 → Task 3 + Task 4 + Task 7f
- [x] 统一各页面导航布局 → 全部 tasks
- [x] URL 保持不变 → Route Group 括号不进入 URL

### Placeholder Scan
- [x] 无 "TBD", "TODO"
- [x] 无 "Add appropriate error handling" 等模糊描述
- [x] 所有代码步骤包含完整代码
- [x] 无 "Similar to Task N" 引用

### Type Consistency
- [x] `useTranslations('notFound')` 在两个 404 页面和 i18n 文件中一致
- [x] `SiteHeader` 和 `SiteFooter` 的 import 路径一致使用 `@/components/...`
- [x] `DashboardSidebar` import 路径一致
