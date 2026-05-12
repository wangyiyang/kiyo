# Dashboard Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户创作区（歌曲、歌词、专辑、设置页面）添加侧边栏导航组件

**Architecture:** 在 `apps/web/src/components` 下创建 `DashboardSidebar` 组件，在 `songs`、`lyrics`、`albums`、`settings` 目录各创建 `layout.tsx` 使用该侧边栏。移动端通过状态控制侧边栏显示/隐藏。

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, lucide-react

---

## 文件结构

```
apps/web/src/
├── components/
│   └── dashboard-sidebar.tsx          # [NEW] 侧边栏主组件
├── app/[locale]/
│   ├── songs/
│   │   └── layout.tsx                 # [NEW] songs 布局
│   ├── lyrics/
│   │   └── layout.tsx                 # [NEW] lyrics 布局
│   ├── albums/
│   │   └── layout.tsx                 # [NEW] albums 布局
│   └── settings/
│       └── layout.tsx                 # [NEW] settings 布局
```

---

## Task 1: 创建 DashboardSidebar 组件

**Files:**
- Create: `apps/web/src/components/dashboard-sidebar.tsx`

- [ ] **Step 1: 创建 dashboard-sidebar.tsx 文件**

```tsx
'use client'

import * as React from 'react'
import Link from '@/i18n/navigation'
import { usePathname } from 'next/navigation'
import {
  Music2,
  Plus,
  PenLine,
  Home,
  Music,
  Mic2,
  Disc,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@kiyo/ui'
import { createBrowserClient } from '@kiyo/supabase'
import { useRouter } from '@/i18n/navigation'

const sidebarNavItems = [
  { href: '/', icon: Home, label: 'nav.home' },
  { href: '/songs', icon: Music, label: 'nav.songs' },
  { href: '/lyrics', icon: Mic2, label: 'nav.lyrics' },
  { href: '/albums', icon: Disc, label: 'nav.albums' },
] as const

const bottomNavItems = [
  { href: '/settings', icon: Settings, label: 'nav.settings' },
] as const

interface DashboardSidebarProps {
  children: React.ReactNode
}

export function DashboardSidebar({ children }: DashboardSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)

  React.useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user)
    })
  }, [])

  const handleSignOut = async () => {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card">
        <SidebarContent
          isActive={isActive}
          onSignOut={handleSignOut}
          isAuthenticated={isAuthenticated}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent
          isActive={isActive}
          onSignOut={handleSignOut}
          isAuthenticated={isAuthenticated}
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile Header with Hamburger */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-xl px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Music2 className="h-5 w-5 text-kiyo-purple" />
            <span>Kiyo</span>
          </Link>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}

interface SidebarContentProps {
  isActive: (href: string) => boolean
  onSignOut: () => void
  isAuthenticated: boolean
  onClose?: () => void
}

function SidebarContent({
  isActive,
  onSignOut,
  isAuthenticated,
  onClose,
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-kiyo-purple to-kiyo-cyan text-white shadow-[0_0_30px_-8px_hsl(var(--kiyo-purple)/0.7)]">
            <Music2 className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Kiyo</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-lg hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3">
        <div className="rounded-xl border border-kiyo-purple/20 bg-gradient-to-br from-kiyo-purple/10 to-kiyo-cyan/5 p-3 space-y-2">
          <Link
            href="/songs/new"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/50 dark:hover:bg-black/10"
          >
            <Plus className="h-4 w-4 text-kiyo-purple" />
            <span>新建歌曲</span>
          </Link>
          <Link
            href="/lyrics/new"
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/50 dark:hover:bg-black/10"
          >
            <PenLine className="h-4 w-4 text-kiyo-cyan" />
            <span>新建歌词</span>
          </Link>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {sidebarNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-kiyo-purple/10 text-kiyo-purple border-l-[3px] border-kiyo-purple -ml-[3px]'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border p-3">
        <div className="space-y-1">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(item.href)
                  ? 'bg-kiyo-purple/10 text-kiyo-purple border-l-[3px] border-kiyo-purple -ml-[3px]'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
          {isAuthenticated && (
            <button
              onClick={() => {
                onSignOut()
                onClose?.()
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>退出登录</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/dashboard-sidebar.tsx
git commit -m "feat(dashboard): add DashboardSidebar component with mobile support"
```

---

## Task 2: 创建 songs layout.tsx

**Files:**
- Create: `apps/web/src/app/[locale]/songs/layout.tsx`

- [ ] **Step 1: 创建 songs/layout.tsx**

```tsx
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function SongsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardSidebar>{children}</DashboardSidebar>
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/songs/layout.tsx
git commit -m "feat(songs): add DashboardSidebar layout"
```

---

## Task 3: 创建 lyrics layout.tsx

**Files:**
- Create: `apps/web/src/app/[locale]/lyrics/layout.tsx`

- [ ] **Step 1: 创建 lyrics/layout.tsx**

```tsx
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function LyricsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardSidebar>{children}</DashboardSidebar>
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/lyrics/layout.tsx
git commit -m "feat(lyrics): add DashboardSidebar layout"
```

---

## Task 4: 创建 albums layout.tsx

**Files:**
- Create: `apps/web/src/app/[locale]/albums/layout.tsx`

- [ ] **Step 1: 创建 albums/layout.tsx**

```tsx
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function AlbumsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardSidebar>{children}</DashboardSidebar>
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/albums/layout.tsx
git commit -m "feat(albums): add DashboardSidebar layout"
```

---

## Task 5: 创建 settings layout.tsx

**Files:**
- Create: `apps/web/src/app/[locale]/settings/layout.tsx`

- [ ] **Step 1: 创建 settings/layout.tsx**

```tsx
import { DashboardSidebar } from '@/components/dashboard-sidebar'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardSidebar>{children}</DashboardSidebar>
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/app/[locale]/settings/layout.tsx
git commit -m "feat(settings): add DashboardSidebar layout"
```

---

## Task 6: 验证和测试

**Files:**
- No file changes

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm --filter web dev
```

- [ ] **Step 2: 手动测试清单**

桌面端测试:
- [ ] 访问 `/songs` 页面，确认左侧显示侧边栏
- [ ] 访问 `/lyrics` 页面，确认左侧显示侧边栏
- [ ] 访问 `/albums` 页面，确认左侧显示侧边栏
- [ ] 访问 `/settings` 页面，确认左侧显示侧边栏
- [ ] 点击侧边栏导航项，确认跳转正确
- [ ] 点击"新建歌曲"按钮，确认跳转 `/songs/new`
- [ ] 点击"新建歌词"按钮，确认跳转 `/lyrics/new`
- [ ] 确认当前页面对应的导航项有紫色高亮

移动端测试:
- [ ] 访问 `/songs` 页面，确认顶部显示汉堡菜单
- [ ] 点击汉堡菜单，确认侧边栏从左侧滑入
- [ ] 点击遮罩层，确认侧边栏关闭
- [ ] 点击侧边栏中的 X 按钮，确认侧边栏关闭
- [ ] 点击导航项，确认跳转并关闭侧边栏

退出登录:
- [ ] 点击"退出登录"按钮，确认退出并跳转首页

- [ ] **Step 3: 提交最终测试通过的记录**

```bash
git add -A
git commit -m "test(dashboard): verify sidebar navigation works correctly"
```

---

## Task 7: 添加翻译 key（如需要）

**Files:**
- Modify: `apps/web/messages/zh.json` (如存在)
- Modify: `apps/web/messages/en.json` (如存在)

- [ ] **Step 1: 检查并添加翻译**

如果导航 label 使用的是 `nav.songs` 等 key，确认 messages 文件中存在对应翻译。如果没有，可以暂时使用中文硬编码（已在组件中使用）。

---

## 总结

完成以上 7 个 Task 后，用户创作区将拥有完整的侧边栏导航，包括：
- 桌面端固定侧边栏
- 移动端抽屉式侧边栏
- 快捷操作入口
- 导航高亮状态
- 退出登录功能
