# Vercel Analytics 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Next.js 应用中集成 Vercel Analytics，实现全环境页面浏览和访客数据追踪。

**Architecture:** 直接引入 `@vercel/analytics/next` 的 `<Analytics />` 组件到根 layout，全环境启用，不做条件渲染。组件内部自动处理去重和路由变化监听。

**Tech Stack:** Next.js 14, React, pnpm, @vercel/analytics

---

### Task 1: 安装 @vercel/analytics 依赖

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 安装依赖**

  在 monorepo 根目录执行：

  ```bash
  pnpm add @vercel/analytics --filter web
  ```

  预期：`@vercel/analytics` 被添加到 `apps/web/package.json` 的 dependencies 中。

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/package.json pnpm-lock.yaml
  git commit -m "chore(analytics): install @vercel/analytics (#55)"
  ```

---

### Task 2: 在根 layout 中引入 Analytics 组件

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: 修改根 layout**

  在 `apps/web/src/app/layout.tsx` 中：

  1. 在现有 imports 下方添加：
     ```tsx
     import { Analytics } from "@vercel/analytics/next";
     ```

  2. 在 `<body>` 的末尾、`<Providers>` 闭标签之后添加 `<Analytics />`：

     ```tsx
     <body className="min-h-screen bg-background font-sans text-foreground antialiased">
       <Providers>
         {children}
         <Toaster richColors closeButton position="top-center" />
       </Providers>
       <Analytics />
     </body>
     ```

  修改后的完整文件（仅展示 body 部分）：

  ```tsx
  export default async function RootLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {
    return (
      <html
        lang={defaultLocale}
        suppressHydrationWarning
        className={`${GeistSans.variable} ${GeistMono.variable}`}
      >
        <body className="min-h-screen bg-background font-sans text-foreground antialiased">
          <Providers>
            {children}
            <Toaster richColors closeButton position="top-center" />
          </Providers>
          <Analytics />
        </body>
      </html>
    );
  }
  ```

- [ ] **Step 2: TypeScript 类型检查**

  ```bash
  pnpm --filter web type-check
  ```

  预期：无报错。

- [ ] **Step 3: Build 验证**

  ```bash
  pnpm --filter web build
  ```

  预期：构建成功。

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/app/layout.tsx
  git commit -m "feat(analytics): integrate Vercel Analytics in root layout (#55)"
  ```

---

## 自审检查

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 安装 `@vercel/analytics` | Task 1 |
| 在根 `app/layout.tsx` 引入 `<Analytics />` | Task 2 |
| 全环境启用（不做条件渲染） | Task 2 |
| `pnpm build` 成功 | Task 2 Step 3 |
| TypeScript 无报错 | Task 2 Step 2 |
