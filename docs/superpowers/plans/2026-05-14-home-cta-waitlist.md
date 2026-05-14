# 首页 CTA 认证状态差异化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让首页 Hero 和 FinalCta 根据用户认证状态展示差异化 CTA — 已登录用户看到「进入控制台」，未登录用户保持现有 Waitlist 入口。

**Architecture:** Server Component `page.tsx` 通过 Supabase 获取认证状态，将 `isAuthenticated` 作为可选 prop 传给 `Hero` 和 `FinalCta`。两个组件均为 Client Component，内部根据 prop 条件渲染不同文案和交互。

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, next-intl, framer-motion, shadcn/ui, Vitest + @testing-library/react

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `apps/web/src/app/[locale]/page.tsx` | 修改 | Server Component，新增 `getUser()` 调用，向下传递 `isAuthenticated` |
| `apps/web/src/components/sections/hero.tsx` | 修改 | 新增 `isAuthenticated` prop，主 CTA 条件渲染 |
| `apps/web/src/components/sections/final-cta.tsx` | 修改 | 新增 `isAuthenticated` prop，内容条件渲染 |
| `apps/web/src/components/sections/hero.test.tsx` | 创建 | Hero 组件单元测试 |
| `apps/web/src/components/sections/final-cta.test.tsx` | 创建 | FinalCta 组件单元测试 |
| `apps/web/messages/zh.json` | 修改 | 新增中文 i18n key |
| `apps/web/messages/en.json` | 修改 | 新增英文 i18n key |

---

### Task 1: 修改 `page.tsx` 添加认证检测与 prop 传递

**Files:**
- Modify: `apps/web/src/app/[locale]/page.tsx`

**Context:** `page.tsx` 是 Server Component，可以在服务端同步调用 `supabase.auth.getUser()` 获取用户状态，无额外网络往返。

- [ ] **Step 1: 导入 Supabase server client**

在现有 import 块中新增：

```tsx
import { createServerClient } from '@kiyo/supabase/server'
```

- [ ] **Step 2: 获取认证状态并传 prop**

修改 `HomePage` 组件：

```tsx
export default async function HomePage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = !!user

  // ... jsonLd 不变 ...

  return (
    <>
      <script ... />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Hero isAuthenticated={isAuthenticated} />
          <Features />
          <HowItWorks />
          <Showcase />
          <FinalCta isAuthenticated={isAuthenticated} />
        </main>
        <SiteFooter />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\[locale\]/page.tsx
git commit -m "feat(home): pass isAuthenticated to Hero and FinalCta from server"
```

---

### Task 2: 修改 `Hero` 组件支持 `isAuthenticated` prop

**Files:**
- Modify: `apps/web/src/components/sections/hero.tsx`

**Context:** `Hero` 当前主 CTA 是 `Button onClick={show}` 触发 Waitlist Dialog。已登录时应改为 `Link href="/dashboard"`。

- [ ] **Step 1: 新增导入**

```tsx
import { Link } from '@/i18n/navigation'
```

- [ ] **Step 2: 新增 prop 接口并修改主 CTA 渲染**

```tsx
export interface HeroProps {
  isAuthenticated?: boolean
}

export function Hero({ isAuthenticated = false }: HeroProps) {
  // ... 现有代码保持不变直到主 CTA ...

  // 主 CTA 部分替换为：
  <motion.div
    initial={{ opacity: 0, y: reduce ? 0 : 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
    className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
  >
    {isAuthenticated ? (
      <Button size="lg" asChild className="group">
        <Link href="/dashboard">
          {t('cta.primaryAuthenticated')}
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Button>
    ) : (
      <Button size="lg" onClick={show} className="group">
        {t('cta.primary')}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Button>
    )}
    <Button size="lg" variant="ghost" asChild>
      <a href="#features">{t('cta.secondary')}</a>
    </Button>
  </motion.div>

  // ... 其余代码不变 ...
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/hero.tsx
git commit -m "feat(hero): differentiate primary CTA by authentication state"
```

---

### Task 3: 为 `Hero` 组件创建单元测试

**Files:**
- Create: `apps/web/src/components/sections/hero.test.tsx`

**Context:** 需要 mock `next-intl`、`framer-motion`、`next/dynamic` 和 `waitlist-context`。

- [ ] **Step 1: 编写测试文件**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'badge': 'AI Music',
      'headline.prefix': 'Let',
      'headline.highlight': 'melody',
      'headline.suffix': 'grow',
      'description': 'Description text',
      'cta.primary': 'Join Waitlist',
      'cta.primaryAuthenticated': 'Go to Dashboard',
      'cta.secondary': 'See what it does',
      'stats.models.label': 'Models',
      'stats.models.value': '5+',
      'stats.genres.label': 'Genres',
      'stats.genres.value': '30+',
      'stats.cycle.label': 'Cycle',
      'stats.cycle.value': 'Minutes',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/lib/waitlist-context', () => ({
  useWaitlist: () => ({ show: vi.fn(), hide: vi.fn(), open: false, setOpen: vi.fn() }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    dl: ({ children, ...props }: any) => <dl {...props}>{children}</dl>,
  },
  useReducedMotion: () => true,
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockWaveform = () => <div data-testid="waveform">Waveform</div>
    MockWaveform.displayName = 'MockWaveform'
    return MockWaveform
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { Hero } from './hero'

describe('Hero', () => {
  it('renders waitlist CTA for unauthenticated users', () => {
    render(<Hero />)
    expect(screen.getByText('Join Waitlist')).toBeInTheDocument()
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument()
  })

  it('renders dashboard CTA for authenticated users', () => {
    render(<Hero isAuthenticated />)
    const dashboardLink = screen.getByText('Go to Dashboard')
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByText('Join Waitlist')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

```bash
cd apps/web && npx vitest run src/components/sections/hero.test.tsx
```

Expected: 2 passed

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/hero.test.tsx
git commit -m "test(hero): add unit tests for authenticated CTA differentiation"
```

---

### Task 4: 修改 `FinalCta` 组件支持 `isAuthenticated` prop

**Files:**
- Modify: `apps/web/src/components/sections/final-cta.tsx`

**Context:** 已登录用户不应看到 Waitlist 表单，而应看到欢迎回来文案和「进入控制台」按钮。

- [ ] **Step 1: 新增导入**

```tsx
import { Link } from '@/i18n/navigation'
import { Button } from '@kiyo/ui'
```

- [ ] **Step 2: 新增 prop 接口并修改内容渲染**

```tsx
export interface FinalCtaProps {
  isAuthenticated?: boolean
}

export function FinalCta({ isAuthenticated = false }: FinalCtaProps) {
  const t = useTranslations('finalCta')

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_hsl(var(--kiyo-purple)/0.18),_transparent_60%)]"
      />
      <div className="container mx-auto px-4">
        {isAuthenticated ? (
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {t('authenticated.headline')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('authenticated.description')}
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="/dashboard">{t('authenticated.cta')}</Link>
              </Button>
            </div>
          </ScrollReveal>
        ) : (
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
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/final-cta.tsx
git commit -m "feat(final-cta): show authenticated welcome CTA for logged-in users"
```

---

### Task 5: 为 `FinalCta` 组件创建单元测试

**Files:**
- Create: `apps/web/src/components/sections/final-cta.test.tsx`

- [ ] **Step 1: 编写测试文件**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'headline.prefix': 'Turn',
      'headline.highlight': 'melody',
      'headline.suffix': 'into track',
      'description': 'Join waitlist',
      'authenticated.headline': 'Welcome back',
      'authenticated.description': 'Next melody waiting',
      'authenticated.cta': 'Go to Dashboard',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('../scroll-reveal', () => ({
  ScrollReveal: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../inline-waitlist-form', () => ({
  InlineWaitlistForm: () => <div data-testid="waitlist-form">Waitlist Form</div>,
}))

import { FinalCta } from './final-cta'

describe('FinalCta', () => {
  it('renders waitlist form for unauthenticated users', () => {
    render(<FinalCta />)
    expect(screen.getByTestId('waitlist-form')).toBeInTheDocument()
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument()
  })

  it('renders authenticated CTA for authenticated users', () => {
    render(<FinalCta isAuthenticated />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('waitlist-form')).not.toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/dashboard')
  })
})
```

- [ ] **Step 2: 运行测试确认通过**

```bash
cd apps/web && npx vitest run src/components/sections/final-cta.test.tsx
```

Expected: 2 passed

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/final-cta.test.tsx
git commit -m "test(final-cta): add unit tests for authenticated state rendering"
```

---

### Task 6: 更新 i18n 翻译文件

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 在 `zh.json` 中新增 key**

在 `hero.cta` 对象内新增：

```json
"primaryAuthenticated": "进入控制台"
```

在 `finalCta` 对象内新增同级对象：

```json
"authenticated": {
  "headline": "欢迎回来，继续创作",
  "description": "你的下一段旋律在等你。",
  "cta": "进入控制台"
}
```

- [ ] **Step 2: 在 `en.json` 中新增 key**

在 `hero.cta` 对象内新增：

```json
"primaryAuthenticated": "Go to Dashboard"
```

在 `finalCta` 对象内新增同级对象：

```json
"authenticated": {
  "headline": "Welcome back, keep creating",
  "description": "Your next melody is waiting.",
  "cta": "Go to Dashboard"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add authenticated CTA translations for home page"
```

---

### Task 7: 类型检查与全量测试验证

- [ ] **Step 1: 运行类型检查**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 2: 运行受影响组件的测试**

```bash
cd apps/web && npx vitest run src/components/sections/hero.test.tsx src/components/sections/final-cta.test.tsx
```

Expected: 4 passed (2 + 2)

- [ ] **Step 3: 运行 Waitlist 相关测试确保无回归**

```bash
cd apps/web && npx vitest run src/components/waitlist-form.test.tsx src/app/actions/waitlist.test.ts
```

Expected: 全部通过

- [ ] **Step 4: Commit（如类型检查有修复）**

```bash
git add -A
git commit -m "fix(types): resolve type errors from authenticated CTA changes"
```

---

## 自审清单

### Spec 覆盖检查

| Spec 要求 | 对应任务 |
|-----------|---------|
| `page.tsx` 服务端获取认证状态 | Task 1 |
| `Hero` 主 CTA 条件渲染 | Task 2 |
| `FinalCta` 内容条件渲染 | Task 4 |
| 新增 i18n key（zh + en） | Task 6 |
| `Hero` 单元测试 | Task 3 |
| `FinalCta` 单元测试 | Task 5 |
| 类型检查与回归测试 | Task 7 |

### Placeholder 扫描

- 无 "TBD"、"TODO"、"implement later"
- 所有步骤包含完整代码或精确命令
- 无 "Similar to Task N" 引用

### 类型一致性

- `isAuthenticated` 在所有组件和测试中统一为可选 `boolean`，默认 `false`
- `Link` 统一从 `@/i18n/navigation` 导入
- i18n key 路径与组件中 `useTranslations` 调用一致
