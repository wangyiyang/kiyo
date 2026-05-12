# Fix(i18n): 后台侧边栏显示 nav.* 文案 key — 设计

## 背景

Issue #134：中文环境进入后台类页面（`/songs`、`/lyrics`、`/albums` 等）后，侧边栏直接显示 `nav.home`、`nav.songs`、`nav.lyrics`、`nav.albums`、`nav.settings` 等 i18n key，而非翻译后的文案。

## 根因

- `apps/web/src/components/dashboard-sidebar.tsx` 的 `sidebarNavItems` / `bottomNavItems` 配置中，`label` 被直接渲染为 `<span>{item.label}</span>`，没有调用 `next-intl` 的 `useTranslations`。
- 当前分支的 `messages/en.json` 和 `messages/zh.json` 中残留 merge conflict markers（`<<<<<<< HEAD` 等），导致 JSON 解析异常并影响 `nav` 命名空间完整性。

## 方案

采用方案 A：在 Sidebar 组件中引入 `useTranslations('nav')`，将 label key 翻译后渲染；同时清理 messages 文件中的 merge conflict markers。

## 变更范围

### 文件 1：`apps/web/src/components/dashboard-sidebar.tsx`

- 导入 `useTranslations` from `'next-intl'`。
- 在 `SidebarContent` 组件内调用 `const tNav = useTranslations('nav')`。
- 将导航项渲染处的 `<span>{item.label}</span>` 改为 `<span>{tNav(item.label)}</span>`。
- 不影响路由、图标、选中态、移动端行为。

### 文件 2 & 3：`apps/web/messages/en.json`、`apps/web/messages/zh.json`

- 删除 `nav` 对象内的 merge conflict markers（`<<<<<<< HEAD`、`=======`、`>>>>>>> b3ef3f2283a1e2dbe7167dc287aed1bbc87411ee`）。
- 保留 `"dashboard"` 和 `"settings"` 两个 key（两者均被 UI 使用）。

## 验收标准

- `/songs`、`/lyrics`、`/albums`、`/songs/new`、`/lyrics/new` 等后台页面侧边栏不再出现 `nav.*`。
- 中文环境显示「首页」「歌曲库」「歌词」「专辑」「设置」。
- 英文环境显示对应英文文案。
- JSON 文件无 merge conflict markers，应用可正常构建。
