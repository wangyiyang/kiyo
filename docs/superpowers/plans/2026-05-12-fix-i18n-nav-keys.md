# Fix(i18n) 后台侧边栏 nav.* key 显示 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复后台侧边栏直接显示 i18n key（`nav.home`、`nav.songs` 等）的问题，并清理 messages 文件中的 merge conflict markers。

**Architecture:** 在 `dashboard-sidebar.tsx` 的 `SidebarContent` 子组件中引入 `useTranslations('nav')`，将 label 作为翻译 key 渲染；同时清理 `messages/en.json` 和 `messages/zh.json` 中的 merge conflict markers。

**Tech Stack:** React, TypeScript, next-intl, Tailwind CSS

---

### Task 1: 清理 messages/zh.json 中的 merge conflict markers

**Files:**
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: 编辑 zh.json 的 nav 区域**

将 `nav` 对象内的 merge conflict markers 替换为干净的字段定义：

```json
  "nav": {
    "menu": "菜单",
    "openMenu": "打开导航菜单",
    "home": "首页",
    "songs": "歌曲库",
    "albums": "专辑",
    "lyrics": "歌词",
    "explore": "探索",
    "language": "语言",
    "theme": "主题",
    "dashboard": "控制台",
    "settings": "设置"
  },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/zh.json
git commit -m "fix(i18n): resolve merge conflict markers in zh.json nav keys"
```

---

### Task 2: 清理 messages/en.json 中的 merge conflict markers

**Files:**
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 编辑 en.json 的 nav 区域**

将 `nav` 对象内的 merge conflict markers 替换为干净的字段定义：

```json
  "nav": {
    "menu": "Menu",
    "openMenu": "Open navigation menu",
    "home": "Home",
    "songs": "Songs",
    "albums": "Albums",
    "lyrics": "Lyrics",
    "explore": "Explore",
    "language": "Language",
    "theme": "Theme",
    "dashboard": "Dashboard",
    "settings": "Settings"
  },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/messages/en.json
git commit -m "fix(i18n): resolve merge conflict markers in en.json nav keys"
```

---

### Task 3: 修复 dashboard-sidebar.tsx 的 i18n 翻译渲染

**Files:**
- Modify: `apps/web/src/components/dashboard-sidebar.tsx`

- [ ] **Step 1: 添加 useTranslations 导入**

在文件顶部导入 `useTranslations`：

```tsx
import { useTranslations } from 'next-intl'
```

- [ ] **Step 2: 在 SidebarContent 中引入翻译函数**

在 `SidebarContent` 函数体的第一行添加：

```tsx
function SidebarContent({
  isActive,
  onSignOut,
  isAuthenticated,
  onClose,
}: SidebarContentProps) {
  const tNav = useTranslations('nav')
  // ...
```

- [ ] **Step 3: 更新 sidebarNavItems 的 label 渲染**

找到侧边栏导航项渲染处，将两个 `<span>{item.label}</span>` 改为使用翻译：

```tsx
<span>{tNav(item.label)}</span>
```

具体有两处（约在 `dashboard-sidebar.tsx` 第 147 行和第 161 行附近）：
- `sidebarNavItems.map(...)` 中的 `<span>{item.label}</span>`
- `bottomNavItems.map(...)` 中的 `<span>{item.label}</span>`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard-sidebar.tsx
git commit -m "fix(i18n): translate nav labels in dashboard sidebar"
```

---

### Task 4: 本地验证

**Files:** 无新增/修改

- [ ] **Step 1: 验证 JSON 语法**

```bash
cd apps/web
npx jsonlint messages/zh.json -q
npx jsonlint messages/en.json -q
```

Expected: 无报错，退出码 0。

- [ ] **Step 2: TypeScript 类型检查**

```bash
pnpm type-check
```

Expected: 无类型错误。

- [ ] **Step 3: 本地启动并手动验证**

```bash
pnpm --filter web dev
```

访问 `http://localhost:3000/songs`，确认左侧侧边栏显示「首页」「歌曲库」「歌词」「专辑」「设置」，而非 `nav.home` 等 key。

---

## Spec Coverage Self-Review

| Spec 要求 | 对应任务 |
|---|---|
| 清理 zh.json merge conflict markers | Task 1 |
| 清理 en.json merge conflict markers | Task 2 |
| sidebar 引入 useTranslations('nav') | Task 3 |
| label 通过 tNav() 渲染而非直接显示 key | Task 3 |
| 不影响路由/图标/选中态 | Task 3（仅修改 label 渲染） |
| 本地验证 | Task 4 |

**Placeholder scan:** 无 TBD、TODO、"implement later"。
**Type consistency:** `useTranslations('nav')` 与项目其他组件一致；`item.label` 值为 `'nav.home'` 样式字符串，传入 `tNav` 后会从 `nav` 命名空间查找，符合 next-intl API 约定。
