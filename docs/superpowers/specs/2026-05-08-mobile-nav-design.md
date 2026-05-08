# Issue #36: Mobile navigation hamburger menu — Design

## Overview

`SiteHeader` 桌面端 `<nav>` 使用 `hidden md:flex`，导致 < 768px 视口下导航链接完全不可见，匿名用户在移动端无法到达 `/songs`、`/albums`、`/lyrics`。本设计补齐移动端导航能力：

- 在 header 右侧追加汉堡按钮（仅 `md:hidden`）
- 点击汉堡触发右侧滑入的 Sheet 抽屉（基于 shadcn Sheet）
- 抽屉内容包含三条导航链接 + LocaleSwitcher + ThemeToggle
- 点击导航项后自动关闭，符合移动端交互直觉
- 顺手把 navLinks 的硬编码中文替换为 `next-intl` 翻译键，与项目其它组件拉通

## Context

- `apps/web/src/components/site-header.tsx`：当前 `<nav className="hidden items-center gap-7 md:flex">`，nav label 硬编码 `'歌曲库' / '专辑' / '歌词'`
- `packages/ui/src/components/ui/`：含 button / dialog / dropdown-menu 等，**无 sheet.tsx**
- `packages/ui/package.json`：已有 `@radix-ui/react-dialog: ^1.1.15`，shadcn Sheet 直接复用，无新增 npm 依赖
- `apps/web/src/components/auth/user-menu.tsx`：登录态用户已通过下拉菜单访问业务页面；匿名用户**完全没有移动端导航入口**——本次解决的真实痛点
- `apps/web/src/components/LocaleSwitcher.tsx`、`theme-toggle.tsx`：当前在 header 右侧，本次原样复用，不修改组件本身
- 项目使用 next-intl，但 SiteHeader / UserMenu 仍用裸 `next/link`，本次保持现状不扩大 i18n routing 改造范围

## Changes

### 1. `packages/ui` — 引入 Sheet 原语

**新增文件**：`packages/ui/src/components/ui/sheet.tsx`

通过 `cd packages/ui && npx shadcn add sheet` 自动生成，复用已安装的 `@radix-ui/react-dialog`。

**修改文件**：`packages/ui/index.ts`

追加导出：
```ts
export {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from './src/components/ui/sheet'
```

### 2. `apps/web` — 新增 MobileNavSheet 组件

**新增文件**：`apps/web/src/components/mobile-nav-sheet.tsx`

```tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Separator,
} from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'

const navLinks = [
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const

export function MobileNavSheet() {
  const t = useTranslations('nav')
  const [open, setOpen] = React.useState(false)

  // 跨断点闭环：用户拖宽窗口至 ≥ md 时，trigger 消失但 Sheet 仍挂载会出现幽灵态
  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('openMenu')}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:w-80">
        <VisuallyHidden>
          <SheetTitle>{t('menu')}</SheetTitle>
        </VisuallyHidden>

        <nav className="mt-8 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-base text-foreground transition-colors hover:bg-accent"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <Separator className="my-6" />

        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('language')}
            </span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('theme')}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

> 设计要点：
> - 状态归属在组件内部（非 SiteHeader），单一职责
> - `md:hidden` 控制在 trigger 按钮自身，让 SiteHeader 不感知断点
> - LocaleSwitcher 触发整页跳转 → Sheet 自然卸载，无需手动关闭
> - ThemeToggle **不**关闭 Sheet，让用户立即对比视觉效果
> - SheetTitle 用 `VisuallyHidden` 包裹，满足 Radix Dialog 的 a11y 强制要求且不占视觉空间

### 3. `apps/web` — 重构 SiteHeader

**修改文件**：`apps/web/src/components/site-header.tsx`

```tsx
// 新增 import
import { MobileNavSheet } from './mobile-nav-sheet'
import { useTranslations } from 'next-intl'

// 替换 navLinks 数组：去除 label 字段，改用 key 配合 t()
const navLinks = [
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const

// 在 SiteHeader 函数体内
const t = useTranslations('nav')

// 桌面 nav 渲染（保持 hidden md:flex）
<nav className="hidden items-center gap-7 md:flex">
  {navLinks.map((link) => (
    <Link key={link.href} href={link.href} className="...">
      {t(link.key)}
    </Link>
  ))}
</nav>

// 右侧操作区追加 MobileNavSheet
<div className="flex items-center gap-2">
  <LocaleSwitcher />
  <ThemeToggle />
  <UserMenu user={user} />
  <MobileNavSheet />   {/* ← 新增，自带 md:hidden */}
</div>
```

### 4. i18n 翻译键

**修改文件**：`apps/web/messages/zh.json`、`apps/web/messages/en.json`

新增 `nav` 命名空间：

```jsonc
// zh.json
{
  "nav": {
    "menu": "菜单",
    "openMenu": "打开导航菜单",
    "songs": "歌曲库",
    "albums": "专辑",
    "lyrics": "歌词",
    "language": "语言",
    "theme": "主题"
  }
}

// en.json
{
  "nav": {
    "menu": "Menu",
    "openMenu": "Open navigation menu",
    "songs": "Songs",
    "albums": "Albums",
    "lyrics": "Lyrics",
    "language": "Language",
    "theme": "Theme"
  }
}
```

桌面 `<nav>` 与移动 Sheet 共用同一份翻译键，避免双份维护。

## Edge Cases

| 场景 | 处置 |
|---|---|
| 跨 md 断点拉宽窗口（Sheet 仍开） | `matchMedia` 监听强制关闭 |
| 切换语言 | LocaleSwitcher 触发整页跳转，Sheet 自然卸载 |
| 用户登录/登出 | UserMenu 在 header 内，与 Sheet 解耦，互不影响 |
| 系统手势返回 | Radix Dialog 不拦截浏览器返回，与原生 modal 对齐 |
| Sheet 内 LocaleSwitcher 的 DropdownMenu 层级 | Radix Portal 自管理 z-index，测试时验证；如有问题给 DropdownMenuContent 加 `container` 指向 SheetContent |

## Testing

### 组件测试（`apps/web/src/components/mobile-nav-sheet.test.tsx`）

1. 默认渲染：trigger 按钮可见，Sheet 内容不在 DOM
2. 点击 trigger：Sheet 打开，3 个 nav link 出现
3. 点击任意 nav link：Sheet 关闭
4. 按 ESC：Sheet 关闭
5. 汉堡按钮 `aria-label` 正确（i18n 验证）
6. 模拟 `matchMedia` 跨断点 → Sheet 关闭

### E2E 测试（`apps/web/tests/e2e/mobile-nav.spec.ts`）

```ts
test('mobile nav drawer flow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await page.getByRole('button', { name: /打开导航菜单|Open navigation menu/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('link', { name: /歌曲库|Songs/ }).click()
  await expect(page).toHaveURL(/\/songs/)
  await expect(page.getByRole('dialog')).toBeHidden()
})
```

### 手动验收清单（贴入 PR）

- [ ] iPhone SE (375×667) Safari：抽屉滑入流畅，文字不溢出
- [ ] Android Chrome (412×915)：抽屉宽度合理
- [ ] iPad 竖屏 (768×1024)：≥ md → 显示桌面 nav，不显示汉堡
- [ ] iPad 跨断点切换（modal 打开时）：Sheet 自动关闭
- [ ] 桌面键盘：Tab → Enter 打开 → Tab 在抽屉内循环 → ESC 关闭 → 焦点回 trigger
- [ ] 暗色主题：抽屉背景与 header 协调
- [ ] 中英文切换：抽屉内切换语言后，Sheet 不残留

## Files to Modify

**新增**
- `packages/ui/src/components/ui/sheet.tsx`（shadcn 自动生成）
- `apps/web/src/components/mobile-nav-sheet.tsx`
- `apps/web/src/components/mobile-nav-sheet.test.tsx`
- `apps/web/tests/e2e/mobile-nav.spec.ts`

**修改**
- `packages/ui/index.ts`（追加 Sheet 系列导出）
- `apps/web/src/components/site-header.tsx`（追加 `<MobileNavSheet />`，nav label 改用 i18n）
- `apps/web/messages/zh.json`（新增 `nav` 命名空间）
- `apps/web/messages/en.json`（新增 `nav` 命名空间）

## Acceptance Criteria

- [ ] 移动端（< 768px）header 右侧显示汉堡按钮，桌面端不显示
- [ ] 点击汉堡按钮，右侧滑入 Sheet 抽屉，含 3 条导航链接 + 语言切换 + 主题切换
- [ ] 点击任一导航链接，跳转目标页且抽屉自动关闭
- [ ] 按 ESC 键、点击遮罩、点击关闭按钮均可关闭抽屉
- [ ] 抽屉打开时，body 滚动被锁定，焦点陷阱在抽屉内循环
- [ ] 抽屉关闭后，焦点归还到汉堡按钮
- [ ] 在抽屉打开状态下拖宽窗口跨过 md 断点，抽屉自动关闭
- [ ] SiteHeader 桌面 `<nav>` 文本由 i18n 控制，与抽屉共用翻译键
- [ ] 新增组件单测、E2E 测试、手动验收清单全部通过

## Dependencies

- 复用：shadcn Sheet（基于已安装的 `@radix-ui/react-dialog`）、`next-intl`、现有 Button / Separator / LocaleSwitcher / ThemeToggle
- 无新增 npm 依赖
- 无数据库迁移
- 无后端 API 改动
