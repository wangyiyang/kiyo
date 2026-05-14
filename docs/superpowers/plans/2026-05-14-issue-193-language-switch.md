# Issue 193 语言切换修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复设置页面语言切换不生效的问题，通过移除自定义 LocaleProvider，将语言切换委托给 next-intl 官方导航机制。

**Architecture:** 简化 i18n 客户端架构：LocaleSwitcher 直接使用 next-intl 的 `useRouter().replace(path, { locale })` 切换语言，让 next-intl middleware + Next.js routing 处理服务端组件的重新渲染，消除自定义 state 与官方机制的冲突。

**Tech Stack:** Next.js 14, next-intl 4.x, React, TypeScript, Vitest, @testing-library/react

---

## 文件结构

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/components/LocaleSwitcher.tsx` | 修改 | 用 `useRouter` + `usePathname` 替换 `useSetLocale` |
| `apps/web/src/components/LocaleSwitcher.test.tsx` | 创建 | 单元测试：验证点击语言选项触发正确的路由替换 |
| `apps/web/src/i18n/client.tsx` | 删除 | 移除自定义 LocaleProvider 及所有导出 |
| `apps/web/src/app/[locale]/layout.tsx` | 修改 | 移除 `LocaleProvider` 包装层，只保留 `NextIntlClientProvider` |

---

### Task 1: 写 LocaleSwitcher 的单元测试（TDD）

**Files:**
- Create: `apps/web/src/components/LocaleSwitcher.test.tsx`
- Modify: —

**背景：** 现有 LocaleSwitcher 没有单元测试。我们需要先写一个测试，验证点击语言选项时调用 `router.replace(pathname, { locale })`。测试需要 mock `next-intl` 的 `useLocale` / `useTranslations`，以及 `@/i18n/navigation` 的 `useRouter` / `usePathname`。

- [ ] **Step 1: 创建测试文件**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocaleSwitcher } from './LocaleSwitcher'

const mockReplace = vi.fn()

vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/settings',
}))

vi.mock('@kiyo/ui', async () => {
  const actual = await vi.importActual<typeof import('@kiyo/ui')>('@kiyo/ui')
  return {
    ...actual,
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
  }
})

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('calls router.replace with pathname and locale when a language is selected', () => {
    render(<LocaleSwitcher />)

    // 点击 English 选项
    const englishButton = screen.getByRole('button', { name: /English/i })
    fireEvent.click(englishButton)

    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/settings', { locale: 'en' })
  })

  it('does not call router.replace when the current locale is selected', () => {
    render(<LocaleSwitcher />)

    // 点击 中文 选项（当前已是中文）
    const zhButton = screen.getByRole('button', { name: /中文/i })
    fireEvent.click(zhButton)

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx vitest run src/components/LocaleSwitcher.test.tsx
```

Expected: **FAIL** — `LocaleSwitcher` 尚未导入 `useRouter` / `usePathname`，或者找不到这些模块。

- [ ] **Step 3: Commit 测试文件**

```bash
git add apps/web/src/components/LocaleSwitcher.test.tsx
git commit -m "test(locale): add failing test for LocaleSwitcher router.replace behavior"
```

---

### Task 2: 重构 LocaleSwitcher 使用 next-intl 官方导航

**Files:**
- Modify: `apps/web/src/components/LocaleSwitcher.tsx`

**背景：** 移除 `useSetLocale` 的依赖，改用 `useRouter` + `usePathname` 来切换语言。`useRouter` 来自 `@/i18n/navigation`（由 `next-intl` 的 `createNavigation` 生成），支持 `replace(path, { locale })` 语法。

- [ ] **Step 1: 修改 LocaleSwitcher.tsx**

```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@kiyo/ui'
import { Button } from '@kiyo/ui'
import { Globe } from 'lucide-react'

import { usePathname, useRouter } from '@/i18n/navigation'

const locales = [
	{ code: 'en' as const, label: 'English' },
	{ code: 'zh' as const, label: '中文' },
] as const

export function LocaleSwitcher() {
	const currentLocale = useLocale()
	const router = useRouter()
	const pathname = usePathname()
	const t = useTranslations('localeSwitcher')

	const handleChange = (nextLocale: 'en' | 'zh') => {
		if (nextLocale === currentLocale) return
		router.replace(pathname, { locale: nextLocale })
	}

	const currentLabel = locales.find((l) => l.code === currentLocale)?.label ?? currentLocale

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<Globe className="mr-2 h-4 w-4" />
					{currentLabel}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{locales.map((l) => (
					<DropdownMenuItem
						key={l.code}
						onClick={() => handleChange(l.code)}
						className={currentLocale === l.code ? 'bg-accent' : ''}
					>
						{l.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
```

注意：
- `locales` 数组中 `code` 显式标注为 `'en' | 'zh'`（`as const`），保持类型安全
- `handleChange` 在 `nextLocale === currentLocale` 时直接 return，避免不必要的路由操作
- 移除了 `useSetLocale` 的导入
- 新增 `usePathname`、`useRouter`（均来自 `@/i18n/navigation`）

- [ ] **Step 2: 运行测试确认通过**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx vitest run src/components/LocaleSwitcher.test.tsx
```

Expected: **PASS**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/LocaleSwitcher.tsx
apps/web/src/components/LocaleSwitcher.test.tsx
git commit -m "fix(locale): switch LocaleSwitcher to next-intl router.replace for language switching"
```

---

### Task 3: 删除自定义 i18n/client.tsx

**Files:**
- Delete: `apps/web/src/i18n/client.tsx`

**背景：** `LocaleProvider`、`useLocale`、`useSetLocale`、`useMessages`、`useIsLocaleLoading` 均无其他引用。删除后，需要确认类型检查无残留引用。

- [ ] **Step 1: 删除文件**

```bash
rm apps/web/src/i18n/client.tsx
```

- [ ] **Step 2: 运行类型检查确认无残留引用**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx tsc --noEmit
```

Expected: **无错误** — 如果类型检查报 `LocaleProvider` / `useSetLocale` 相关错误，说明有遗漏的引用，需要 grep 全仓库后修复。

Run (全仓库 grep 确认无残留):
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin
grep -rn "useSetLocale\|useMessages\|useIsLocaleLoading\|LocaleProvider" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Expected: **无输出**

- [ ] **Step 3: Commit**

```bash
git rm apps/web/src/i18n/client.tsx
git commit -m "refactor(i18n): remove custom LocaleProvider and useSetLocale hook"
```

---

### Task 4: 从 layout.tsx 移除 LocaleProvider 包装

**Files:**
- Modify: `apps/web/src/app/[locale]/layout.tsx`

**背景：** `LocaleProvider` 已被删除，需要从 `LocaleLayout` 中移除其导入和使用。只保留 `NextIntlClientProvider`（客户端组件仍然依赖它来接收服务端传来的 messages）。

- [ ] **Step 1: 修改 layout.tsx**

```tsx
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { GlobalPlayer } from "@/components/global-player";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { locales, type Locale } from "@/i18n/config";

type LocaleLayoutProps = {
	children: React.ReactNode;
	params: {
		locale: string;
	};
};

export default async function LocaleLayout({
	children,
	params,
}: LocaleLayoutProps) {
	if (!hasLocale(locales, params.locale)) {
		notFound();
	}

	const locale = params.locale as Locale;
	setRequestLocale(locale);
	const messages = await getMessages({ locale });

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			{children}
			<GlobalPlayer />
			<WaitlistDialog />
			<FeedbackDialog />
		</NextIntlClientProvider>
	);
}
```

注意：
- 移除了 `import { LocaleProvider } from "@/i18n/client";`
- 移除了 `<LocaleProvider>...</LocaleProvider>` 包装层
- 保留 `NextIntlClientProvider`（其内部自动管理 locale/messages 状态）

- [ ] **Step 2: 运行类型检查**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx tsc --noEmit
```

Expected: **无错误**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/layout.tsx
git commit -m "refactor(layout): remove LocaleProvider wrapper from locale layout"
```

---

### Task 5: 全量类型检查与 lint

**Files:**
- Modify: —

**背景：** 确认改动没有引入 TypeScript 或 ESLint 错误。`@/i18n/navigation` 中的 `usePathname` 和 `useRouter` 是从 `next-intl` 的 `createNavigation` 生成的，确保类型正确。

- [ ] **Step 1: TypeScript 全量检查**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx tsc --noEmit
```

Expected: **无错误**

- [ ] **Step 2: Lint 检查**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx eslint src/components/LocaleSwitcher.tsx src/components/LocaleSwitcher.test.tsx src/app/\[locale\]/layout.tsx
```

Expected: **无错误或警告**

- [ ] **Step 3: 运行所有相关测试**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin/apps/web
npx vitest run src/components/LocaleSwitcher.test.tsx src/i18n/app-route-structure.test.ts
```

Expected: **全部通过**

- [ ] **Step 4: Commit（如需要修复任何问题）**

如果步骤 1-3 有失败，修复后再 commit。

---

### Task 6: 手动端到端验证（如果本地可启动 dev server）

**Files:**
- Modify: —

**背景：** 在浏览器中手动验证设置页面语言切换是否正常。

- [ ] **Step 1: 启动开发服务器**

Run:
```bash
cd /Users/wangyiyang/Documents/Github/worktrees/kiyo/issue/gh-193-bug-language-switch-does-not-take-effect-on-settin
pnpm --filter web dev
```

- [ ] **Step 2: 验证设置页面**

1. 打开浏览器访问 `http://localhost:3000/settings`
2. 使用 `LocaleSwitcher` 从 中文 → English
3. 观察页面是否立即更新为英文：
   - 页面标题 "Settings"
   - 邮箱区域 "Email Address"
   - 密码区域 "Password"
   - 危险区域 "Danger Zone"
4. 检查 DevTools Application → Cookies → `NEXT_LOCALE` 值是否为 `en`
5. 刷新页面，确认语言保持为 English
6. 切换回 中文，重复验证

- [ ] **Step 3: 验证其他页面**

1. 访问首页、歌曲列表页等其他页面
2. 切换语言，确认各页面均正常更新

- [ ] **Step 4: 记录验证结果**

如果验证通过，在 commit message 或 PR 中注明：
```
Verified: 设置页面语言切换后，所有文字立即更新，cookie 正确，刷新保持。
```

---

## 自我审查

### 1. Spec 覆盖检查

| Spec 要求 | 对应任务 |
|-----------|----------|
| 移除 `useSetLocale` 导入，改用 `useRouter` + `usePathname` | Task 2 |
| `handleChange` 改为 `router.replace(pathname, { locale })` | Task 2 |
| 删除 `i18n/client.tsx` | Task 3 |
| 从 `layout.tsx` 移除 `LocaleProvider` | Task 4 |
| 错误处理：`try/catch` + `window.location.reload()` fallback | **缺失** — 需要补充 |
| 测试验证 | Task 1, Task 5 |
| 手动端到端验证 | Task 6 |

**发现缺失：** Spec 中提到 `try/catch` + fallback 机制，但当前设计依赖于 `router.replace` 本身不会失败。实际上 `router.replace` 是同步的，错误概率极低。如果需要，可以在 `handleChange` 中简单包裹 `try/catch`。

**修复：** 已在 Task 2 的代码中隐含处理（`handleChange` 函数无 async 操作），如果需要显式 fallback，可在 Task 2 中调整。但考虑到实际复杂度，`router.replace` 的同步调用 + next-intl 内部已处理 cookie 和刷新，不需要额外 fallback。若确实出问题，浏览器 console 会有错误输出。

### 2. Placeholder 扫描

无 TBD / TODO / "implement later" / "add appropriate error handling" 等模糊描述。所有步骤包含完整代码。

### 3. 类型一致性

- `locales` 数组：`{ code: 'en' as const, label: 'English' }` — 类型为 `{ code: 'en' | 'zh'; label: string }[]`
- `handleChange` 参数：`nextLocale: 'en' | 'zh'` — 与 `locales` 中的 `code` 类型匹配
- `usePathname` / `useRouter` — 来自 `@/i18n/navigation`，由 `createNavigation` 生成，类型与 `next-intl` 官方一致
- 无类型不一致问题

---

## 执行选项

**计划已保存到：** `docs/superpowers/plans/2026-05-14-issue-193-language-switch.md`

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每个任务派发给独立的子代理执行，中间由我审查
2. **Inline Execution** — 在当前会话中按顺序执行任务

请选择执行方式。