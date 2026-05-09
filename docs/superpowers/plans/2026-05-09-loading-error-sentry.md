# Loading、错误边界与 Sentry 接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Kiyo Web 应用补齐 App Router 加载态、错误边界和 Sentry 生产错误监控基础能力。

**Architecture:** 新增一个 `monitoring` 薄封装隔离 Sentry SDK，错误边界统一复用 `ErrorBoundaryPage`，loading skeleton 统一放在 `loading-skeletons` 中供全局和列表页复用。Sentry SDK 按 Next.js 14 可用路径接入，关键业务失败点显式调用监控封装。

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Vitest, Testing Library, Tailwind CSS, `@kiyo/ui`, `@sentry/nextjs`, pnpm

---

## 文件结构映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/package.json` | 修改 | 添加 `@sentry/nextjs` 依赖 |
| `pnpm-lock.yaml` | 修改 | pnpm 依赖锁文件，注意保留用户已有锁文件改动 |
| `apps/web/next.config.js` | 修改 | 使用 `withSentryConfig` 包裹现有 `next-intl` 配置，并扩展 CSP |
| `apps/web/.env.local.example` | 修改 | 记录 Sentry DSN 和 source map 上传变量 |
| `apps/web/src/instrumentation.ts` | 新建 | Next.js 运行时注册 server/edge Sentry 配置 |
| `apps/web/src/instrumentation-client.ts` | 新建 | 浏览器端 Sentry 初始化 |
| `apps/web/sentry.server.config.ts` | 新建 | Node runtime Sentry 初始化 |
| `apps/web/sentry.edge.config.ts` | 新建 | Edge runtime Sentry 初始化 |
| `apps/web/src/lib/monitoring.ts` | 新建 | 统一异常捕获封装 |
| `apps/web/src/lib/monitoring.test.ts` | 新建 | 监控封装测试 |
| `apps/web/src/components/error-boundary-page.tsx` | 新建 | 统一错误页展示组件 |
| `apps/web/src/components/error-boundary-page.test.tsx` | 新建 | 错误页交互与上报测试 |
| `apps/web/src/components/loading-skeletons.tsx` | 新建 | 全局、歌曲列表、专辑列表 skeleton 组件 |
| `apps/web/src/components/loading-skeletons.test.tsx` | 新建 | loading skeleton 结构测试 |
| `apps/web/src/app/error.tsx` | 修改 | 使用统一错误 UI 并上报 root 边界异常 |
| `apps/web/src/app/[locale]/error.tsx` | 修改 | 使用统一错误 UI 并上报 locale 边界异常 |
| `apps/web/src/app/global-error.tsx` | 新建 | 根布局兜底错误页，包含 `<html>` 和 `<body>` |
| `apps/web/src/app/loading.tsx` | 新建 | 全局 loading |
| `apps/web/src/app/songs/loading.tsx` | 新建 | 歌曲列表局部 loading |
| `apps/web/src/app/albums/loading.tsx` | 新建 | 专辑列表局部 loading |
| `apps/web/src/app/actions/waitlist.ts` | 修改 | waitlist 写入失败时上报 |
| `apps/web/src/app/api/lyrics/generate/route.ts` | 修改 | 歌词生成失败时上报 |
| `apps/web/src/app/api/songs/generate/route.ts` | 修改 | 歌曲生成失败时上报 |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | 修改 | 已有歌曲生成失败时上报 |
| `apps/web/src/app/api/songs/cover/route.ts` | 修改 | 歌曲封面生成/上传失败时上报 |
| `apps/web/src/app/api/songs/[id]/cover/route.ts` | 修改 | 指定歌曲封面生成/上传失败时上报 |
| `apps/web/src/app/api/albums/[id]/cover/route.ts` | 修改 | 专辑封面生成/上传失败时上报 |

---

### Task 1: 安装 Sentry SDK 依赖

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: 安装依赖**

Run:

```bash
pnpm --filter web add @sentry/nextjs
```

Expected: `apps/web/package.json` 出现 `@sentry/nextjs`，`pnpm-lock.yaml` 更新。执行前先查看锁文件已有 diff，执行后只接受 pnpm 生成的依赖变更，不手动回滚用户已有锁文件改动。

- [ ] **Step 2: 验证依赖可解析**

Run:

```bash
pnpm --filter web exec node -e "require.resolve('@sentry/nextjs'); console.log('sentry ok')"
```

Expected: 输出 `sentry ok`。

- [ ] **Step 3: 提交依赖变更**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add sentry nextjs sdk"
```

---

### Task 2: 监控封装

**Files:**
- Create: `apps/web/src/lib/monitoring.test.ts`
- Create: `apps/web/src/lib/monitoring.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/lib/monitoring.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException,
}))

describe('captureAppException', () => {
  beforeEach(() => {
    captureException.mockClear()
  })

  it('captures errors with tags and context', async () => {
    const { captureAppException } = await import('./monitoring')
    const error = new Error('generation failed')

    captureAppException(error, {
      tags: { area: 'lyrics', operation: 'generate' },
      extra: { lyricId: 'lyric_123' },
    })

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'lyrics', operation: 'generate' },
      extra: { lyricId: 'lyric_123' },
    })
  })

  it('normalizes non-error values before capture', async () => {
    const { captureAppException } = await import('./monitoring')

    captureAppException('plain failure', {
      tags: { area: 'waitlist' },
    })

    expect(captureException).toHaveBeenCalledTimes(1)
    const [capturedError, context] = captureException.mock.calls[0]
    expect(capturedError).toBeInstanceOf(Error)
    expect(capturedError.message).toBe('plain failure')
    expect(context).toEqual({ tags: { area: 'waitlist' } })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter web test src/lib/monitoring.test.ts
```

Expected: FAIL，原因是 `Cannot find module './monitoring'`。

- [ ] **Step 3: 实现最小封装**

Create `apps/web/src/lib/monitoring.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

type MonitoringContext = {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

function normalizeException(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  return new Error(typeof error === 'string' ? error : 'Unknown application error')
}

export function captureAppException(
  error: unknown,
  context: MonitoringContext = {}
) {
  Sentry.captureException(normalizeException(error), context)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm --filter web test src/lib/monitoring.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/lib/monitoring.ts apps/web/src/lib/monitoring.test.ts
git commit -m "feat(web): add monitoring wrapper"
```

---

### Task 3: 统一错误 UI

**Files:**
- Create: `apps/web/src/components/error-boundary-page.test.tsx`
- Create: `apps/web/src/components/error-boundary-page.tsx`
- Modify: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/[locale]/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/components/error-boundary-page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { ErrorBoundaryPage } from './error-boundary-page'

describe('ErrorBoundaryPage', () => {
  it('renders friendly copy and digest without exposing raw message', () => {
    render(
      <ErrorBoundaryPage
        error={Object.assign(new Error('database password leaked'), {
          digest: 'abc123',
        })}
        reset={vi.fn()}
        homeHref="/zh"
      />
    )

    expect(screen.getByRole('heading', { name: '出错了' })).toBeInTheDocument()
    expect(screen.getByText('错误 ID: abc123')).toBeInTheDocument()
    expect(screen.queryByText('database password leaked')).not.toBeInTheDocument()
  })

  it('calls reset when retry is clicked', () => {
    const reset = vi.fn()

    render(
      <ErrorBoundaryPage
        error={new Error('render failed')}
        reset={reset}
        homeHref="/"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /重试/i }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('links back to the provided home href', () => {
    render(
      <ErrorBoundaryPage
        error={new Error('render failed')}
        reset={vi.fn()}
        homeHref="/en"
      />
    )

    expect(screen.getByRole('link', { name: /返回首页/i })).toHaveAttribute(
      'href',
      '/en'
    )
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter web test src/components/error-boundary-page.test.tsx
```

Expected: FAIL，原因是 `Cannot find module './error-boundary-page'`。

- [ ] **Step 3: 实现错误 UI 组件**

Create `apps/web/src/components/error-boundary-page.tsx`:

```tsx
import { Button } from '@kiyo/ui'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

type ErrorBoundaryPageProps = {
  error: Error & { digest?: string }
  reset: () => void
  homeHref: string
}

export function ErrorBoundaryPage({
  error,
  reset,
  homeHref,
}: ErrorBoundaryPageProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">出错了</h1>
        <p className="mt-2 text-muted-foreground">
          抱歉，页面发生了意外错误。你可以重试或返回首页。
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">
            错误 ID: {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            重试
          </Button>
          <Button variant="outline" asChild>
            <a href={homeHref}>
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              返回首页
            </a>
          </Button>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm --filter web test src/components/error-boundary-page.test.tsx
```

Expected: PASS。

- [ ] **Step 5: 改造 root error**

Replace `apps/web/src/app/error.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'app-error' },
      extra: { digest: error.digest },
    })
  }, [error])

  return <ErrorBoundaryPage error={error} reset={reset} homeHref="/" />
}
```

- [ ] **Step 6: 改造 locale error**

Replace `apps/web/src/app/[locale]/error.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LocaleErrorPage({ error, reset }: ErrorPageProps) {
  const params = useParams<{ locale?: string }>()
  const locale: Locale = isSupportedLocale(params.locale)
    ? params.locale
    : defaultLocale

  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'locale-error', locale },
      extra: { digest: error.digest },
    })
  }, [error, locale])

  return <ErrorBoundaryPage error={error} reset={reset} homeHref={`/${locale}`} />
}

function isSupportedLocale(locale: string | undefined): locale is Locale {
  return locales.some((supportedLocale) => supportedLocale === locale)
}
```

- [ ] **Step 7: 新增 global error**

Create `apps/web/src/app/global-error.tsx`:

```tsx
'use client'

import './globals.css'

import { useEffect } from 'react'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'global-error' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ErrorBoundaryPage error={error} reset={reset} homeHref="/" />
      </body>
    </html>
  )
}
```

- [ ] **Step 8: 运行相关测试和类型检查**

Run:

```bash
pnpm --filter web test src/components/error-boundary-page.test.tsx
pnpm --filter web type-check
```

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/components/error-boundary-page.tsx apps/web/src/components/error-boundary-page.test.tsx apps/web/src/app/error.tsx 'apps/web/src/app/[locale]/error.tsx' apps/web/src/app/global-error.tsx
git commit -m "feat(web): add app router error boundaries"
```

---

### Task 4: Loading skeleton

**Files:**
- Create: `apps/web/src/components/loading-skeletons.test.tsx`
- Create: `apps/web/src/components/loading-skeletons.tsx`
- Create: `apps/web/src/app/loading.tsx`
- Create: `apps/web/src/app/songs/loading.tsx`
- Create: `apps/web/src/app/albums/loading.tsx`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/components/loading-skeletons.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import {
  AlbumsListSkeleton,
  GlobalPageSkeleton,
  SongsListSkeleton,
} from './loading-skeletons'

describe('loading skeletons', () => {
  it('renders global loading status', () => {
    render(<GlobalPageSkeleton />)

    expect(screen.getByRole('status', { name: '页面加载中' })).toBeInTheDocument()
  })

  it('renders six song card placeholders', () => {
    render(<SongsListSkeleton />)

    expect(screen.getByRole('status', { name: '歌曲列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('song-card-skeleton')).toHaveLength(6)
  })

  it('renders six album card placeholders', () => {
    render(<AlbumsListSkeleton />)

    expect(screen.getByRole('status', { name: '专辑列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card-skeleton')).toHaveLength(6)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter web test src/components/loading-skeletons.test.tsx
```

Expected: FAIL，原因是 `Cannot find module './loading-skeletons'`。

- [ ] **Step 3: 实现 skeleton 组件**

Create `apps/web/src/components/loading-skeletons.tsx`:

```tsx
import { Skeleton } from '@kiyo/ui'

export function GlobalPageSkeleton() {
  return (
    <main
      role="status"
      aria-label="页面加载中"
      className="container mx-auto flex min-h-screen items-center justify-center px-4"
    >
      <section className="w-full max-w-3xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-lg" />
          ))}
        </div>
      </section>
    </main>
  )
}

export function SongsListSkeleton() {
  return (
    <main className="container mx-auto py-8">
      <section role="status" aria-label="歌曲列表加载中">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              data-testid="song-card-skeleton"
              className="rounded-lg border bg-card p-4 shadow-sm"
            >
              <Skeleton className="mb-3 aspect-video w-full rounded-md" />
              <div className="mb-2 flex items-center gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="ml-auto h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

export function AlbumsListSkeleton() {
  return (
    <main className="container mx-auto py-8">
      <section role="status" aria-label="专辑列表加载中">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              data-testid="album-card-skeleton"
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <Skeleton className="mb-3 aspect-square w-full rounded-lg" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: 新增 route loading 文件**

Create `apps/web/src/app/loading.tsx`:

```tsx
import { GlobalPageSkeleton } from '@/components/loading-skeletons'

export default function Loading() {
  return <GlobalPageSkeleton />
}
```

Create `apps/web/src/app/songs/loading.tsx`:

```tsx
import { SongsListSkeleton } from '@/components/loading-skeletons'

export default function SongsLoading() {
  return <SongsListSkeleton />
}
```

Create `apps/web/src/app/albums/loading.tsx`:

```tsx
import { AlbumsListSkeleton } from '@/components/loading-skeletons'

export default function AlbumsLoading() {
  return <AlbumsListSkeleton />
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
pnpm --filter web test src/components/loading-skeletons.test.tsx
pnpm --filter web type-check
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/loading-skeletons.tsx apps/web/src/components/loading-skeletons.test.tsx apps/web/src/app/loading.tsx apps/web/src/app/songs/loading.tsx apps/web/src/app/albums/loading.tsx
git commit -m "feat(web): add loading skeletons"
```

---

### Task 5: Sentry SDK 配置

**Files:**
- Create: `apps/web/src/instrumentation.ts`
- Create: `apps/web/src/instrumentation-client.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Modify: `apps/web/next.config.js`
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: 写配置冒烟测试**

Run before implementation:

```bash
test -f apps/web/src/instrumentation.ts && test -f apps/web/src/instrumentation-client.ts && test -f apps/web/sentry.server.config.ts && test -f apps/web/sentry.edge.config.ts
```

Expected: FAIL，因为这些文件尚不存在。

- [ ] **Step 2: 新增 runtime 注册文件**

Create `apps/web/src/instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}
```

- [ ] **Step 3: 新增浏览器端配置**

Create `apps/web/src/instrumentation-client.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  })
}
```

- [ ] **Step 4: 新增 server 配置**

Create `apps/web/sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  })
}
```

- [ ] **Step 5: 新增 edge 配置**

Create `apps/web/sentry.edge.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,
  })
}
```

- [ ] **Step 6: 修改 Next 配置**

Replace `module.exports = withNextIntl(nextConfig)` in `apps/web/next.config.js` with:

```javascript
const { withSentryConfig } = require('@sentry/nextjs')

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
}

module.exports = withSentryConfig(withNextIntl(nextConfig), sentryConfig)
```

Also extend CSP `connect-src` from:

```javascript
"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
```

to:

```javascript
"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.ingest.sentry.io",
```

- [ ] **Step 7: 更新环境变量示例**

Append to `apps/web/.env.local.example`:

```dotenv

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

- [ ] **Step 8: 验证配置可解析**

Run:

```bash
pnpm --filter web type-check
pnpm --filter web lint
```

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add apps/web/src/instrumentation.ts apps/web/src/instrumentation-client.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts apps/web/next.config.js apps/web/.env.local.example
git commit -m "feat(web): configure sentry"
```

---

### Task 6: 关键业务异常上报

**Files:**
- Modify: `apps/web/src/app/actions/waitlist.ts`
- Modify: `apps/web/src/app/api/lyrics/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/[id]/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/cover/route.ts`
- Modify: `apps/web/src/app/api/songs/[id]/cover/route.ts`
- Modify: `apps/web/src/app/api/albums/[id]/cover/route.ts`

- [ ] **Step 1: 写 waitlist 失败上报测试**

Create `apps/web/src/app/actions/waitlist.test.ts`:

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

describe('waitlist action monitoring', () => {
  beforeEach(() => {
    captureAppException.mockClear()
    insert.mockReset()
    getHeader.mockClear()
  })

  it('captures insert failures', async () => {
    const error = { code: 'PGRST500', message: 'database unavailable' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'creator',
    })

    expect(result).toEqual({
      ok: false,
      code: 'UNKNOWN',
      message: '提交失败，请稍后再试',
    })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role: 'creator',
      source: 'landing',
      user_agent: 'Vitest',
    })
    expect(captureAppException).toHaveBeenCalledWith(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --filter web test src/app/actions/waitlist.test.ts
```

Expected: FAIL，原因是 `captureAppException` 尚未被调用。

- [ ] **Step 3: 修改 waitlist action**

In `apps/web/src/app/actions/waitlist.ts`, import:

```typescript
import { captureAppException } from '@/lib/monitoring'
```

Inside the existing insert failure branch, add:

```typescript
captureAppException(error, {
  tags: { area: 'waitlist', operation: 'insert' },
})
```

- [ ] **Step 4: 运行 waitlist 测试确认通过**

Run:

```bash
pnpm --filter web test src/app/actions/waitlist.test.ts
```

Expected: PASS。

- [ ] **Step 5: 修改生成与封面 catch 分支**

For each catch block handling `err` or `error`, add:

```typescript
captureAppException(err, {
  tags: { area: 'songs', operation: 'generate' },
})
```

Use exact tags per file:

```typescript
// apps/web/src/app/api/lyrics/generate/route.ts
{ area: 'lyrics', operation: 'generate' }

// apps/web/src/app/api/songs/generate/route.ts
{ area: 'songs', operation: 'generate' }

// apps/web/src/app/api/songs/[id]/generate/route.ts
{ area: 'songs', operation: 'regenerate' }

// apps/web/src/app/api/songs/cover/route.ts
{ area: 'songs', operation: 'cover' }

// apps/web/src/app/api/songs/[id]/cover/route.ts
{ area: 'songs', operation: 'cover' }

// apps/web/src/app/api/albums/[id]/cover/route.ts
{ area: 'albums', operation: 'cover' }
```

If a catch parameter is named `error`, pass `error` instead of `err`.

- [ ] **Step 6: 运行现有 API tests**

Run:

```bash
pnpm --filter web test src/app/api/lyrics/generate/route.test.ts src/app/api/songs/generate/route.test.ts src/app/api/songs/[id]/generate/route.test.ts src/app/api/songs/cover/route.test.ts src/app/api/songs/[id]/cover/route.test.ts src/app/api/albums/[id]/cover/route.test.ts
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/app/actions/waitlist.ts apps/web/src/app/actions/waitlist.test.ts apps/web/src/app/api/lyrics/generate/route.ts apps/web/src/app/api/songs/generate/route.ts apps/web/src/app/api/songs/[id]/generate/route.ts apps/web/src/app/api/songs/cover/route.ts apps/web/src/app/api/songs/[id]/cover/route.ts apps/web/src/app/api/albums/[id]/cover/route.ts
git commit -m "feat(web): capture critical app failures"
```

---

### Task 7: 整体验证与收尾

**Files:**
- Verify only

- [ ] **Step 1: 运行单元测试**

Run:

```bash
pnpm --filter web test
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm --filter web type-check
```

Expected: PASS。

- [ ] **Step 3: 运行 lint**

Run:

```bash
pnpm --filter web lint
```

Expected: PASS。

- [ ] **Step 4: 检查工作区**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: 只有本任务预期改动，且每个任务有独立 commit。

- [ ] **Step 5: 准备 PR 描述**

Use this structure:

```markdown
## 目的/结论

关闭 #68 和 #54：补齐 App Router loading/error/global-error，并接入 Sentry 基础错误监控。

## 改动点

- 添加 `@sentry/nextjs` 配置、运行时初始化和环境变量示例。
- 抽取统一错误 UI，并接入 root、locale、global error boundary。
- 添加全局、歌曲列表、专辑列表 loading skeleton。
- 为 waitlist、AI 生成、封面相关关键失败点增加 Sentry 上报。

## 影响与风险

- Sentry DSN 未配置时不发送事件，不影响本地运行。
- 浏览器端上报需要 CSP 允许 Sentry ingest 域名。
- Next.js 14 未启用 Next.js 15-only 的 `onRequestError`。

## 验证

- `pnpm --filter web test`
- `pnpm --filter web type-check`
- `pnpm --filter web lint`
```
