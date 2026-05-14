# Issue #195 导航统一重构设计文档

> **问题**: 隐私政策、用户协议、联系我们三个静态页面缺少顶部导航栏；404 页面过于简陋；设置页面导航重复。  
> **方案**: 使用 Next.js Route Group 将页面按导航模式分组，统一布局管理。

---

## 1. 问题现状

| 页面 | 当前导航 | 问题 |
|------|---------|------|
| `/` 首页 | `SiteHeader`（内联） | 正常，但重复内联 |
| `/explore` | `SiteHeader`（内联） | 正常，但重复内联 |
| `/songs` `/albums` `/lyrics` | `DashboardSidebar` | 正常 |
| `/settings` | `DashboardSidebar` + `SiteHeader` | **导航重复** |
| `/privacy` `/terms` `/contact` | 无 | **完全缺失导航** |
| `/login` `/register` | `SiteHeader`（内联） | 正常，但重复内联 |
| `/forgot-password` `/reset-password` | 无 | 缺失导航（可选修复） |
| `/dashboard` | `SiteHeader` + `SiteFooter`（内联） | 与 songs 等不一致 |
| 404 (`not-found.tsx`) | 无导航、无返回链接 | 过于简陋 |

## 2. Route Group 目录结构

将页面按导航模式分为两个 **Route Group**（URL 不变，括号不进入路由）：

```
[locale]/
  layout.tsx              ← 保留：i18n Provider、GlobalPlayer、WaitlistDialog、FeedbackDialog
  error.tsx               ← 保留
  loading.tsx             ← 保留
  (site)/
    layout.tsx            ← 新增：提供 SiteHeader
    page.tsx              ← 从 [locale]/ 移入（首页）
    not-found.tsx         ← 新增（增强版 404）
    explore/
      page.tsx
    contact/
      page.tsx
    privacy/
      page.tsx
    terms/
      page.tsx
    login/
      page.tsx
    register/
      page.tsx
    forgot-password/
      page.tsx
    reset-password/
      page.tsx
  (dashboard)/
    layout.tsx            ← 新增：提供 DashboardSidebar
    not-found.tsx         ← 新增（增强版 404，带侧边栏）
    dashboard/
      page.tsx            ← 从 [locale]/ 移入，移除 SiteHeader/SiteFooter
    songs/
      page.tsx
      layout.tsx          ← 删除（由父级提供）
      songs-list.tsx
      ...
    albums/
      page.tsx
      layout.tsx          ← 删除
      ...
    lyrics/
      page.tsx
      layout.tsx          ← 删除
      ...
    settings/
      page.tsx            ← 从 [locale]/ 移入，移除 SiteHeader
      layout.tsx          ← 删除
```

## 3. Layout 定义

### 3.1 `(site)/layout.tsx`

提供顶部导航 `SiteHeader`，包裹所有公共展示型页面。

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

### 3.2 `(dashboard)/layout.tsx`

提供侧边栏导航 `DashboardSidebar`，包裹所有创作/管理型页面。

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

## 4. Page 文件清理

以下页面中**内联的 `SiteHeader`/`SiteFooter` import 和 JSX 将被移除**，由 layout 统一提供：

| 文件路径 | 移除内容 |
|---------|---------|
| `(site)/page.tsx`（原首页） | `SiteHeader` 和 `SiteFooter` 的 import 和 JSX |
| `(site)/explore/page.tsx` | `SiteHeader` 和 `SiteFooter` 的 import 和 JSX |
| `(site)/login/page.tsx` | `SiteHeader` 的 import 和 JSX |
| `(site)/register/page.tsx` | `SiteHeader` 的 import 和 JSX |
| `(dashboard)/dashboard/page.tsx` | `SiteHeader` 和 `SiteFooter` 的 import 和 JSX |
| `(dashboard)/settings/page.tsx` | `SiteHeader` 的 import 和 JSX |

`songs/`、`albums/`、`lyrics/`、`settings/` 各自子目录中仅包裹 `DashboardSidebar` 的 `layout.tsx` 将删除，由 `(dashboard)/layout.tsx` 替代。

## 5. 404 页面增强

在 `(site)/not-found.tsx` 和 `(dashboard)/not-found.tsx` 中分别提供对应导航布局下的 404 页面。

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

### 5.1 i18n 翻译键新增

在 `messages/zh.json` 和 `messages/en.json` 的 `notFound` 命名空间下新增：

```json
{
  "notFound": {
    "title": "页面未找到",
    "description": "您访问的页面不存在。",
    "backToHome": "返回首页"
  }
}
```

```json
{
  "notFound": {
    "title": "Page Not Found",
    "description": "The page you are looking for does not exist.",
    "backToHome": "Back to home"
  }
}
```

## 6. URL 兼容性

Route Group 的括号 `()` 在 URL 中不可见，所有现有 URL 完全保持不变：

- `/` → 不变
- `/explore` → 不变
- `/songs`、`/songs/new` → 不变
- `/albums` → 不变
- `/lyrics` → 不变
- `/privacy`、`/terms`、`/contact` → 不变
- `/settings` → 不变
- `/dashboard` → 不变
- `/login`、`/register` → 不变

## 7. 测试验证

### 7.1 导航一致性检查

- [ ] `/privacy` 显示 `SiteHeader`，包含 Logo、导航链接、语言切换、主题切换、用户菜单
- [ ] `/terms` 显示 `SiteHeader`
- [ ] `/contact` 显示 `SiteHeader`
- [ ] `/settings` 仅显示 `DashboardSidebar`，无重复顶部导航
- [ ] `/songs`、`/albums`、`/lyrics` 正常显示 `DashboardSidebar`
- [ ] `/dashboard` 正常显示 `DashboardSidebar`，无重复顶部导航

### 7.2 404 页面检查

- [ ] 访问 `/zh/nonexistent-page` 显示 404，包含返回首页按钮，按钮文案为中文
- [ ] 访问 `/en/nonexistent-page` 显示 404，包含返回首页按钮，按钮文案为英文
- [ ] 404 页面在 `(site)` 组下显示 `SiteHeader`
- [ ] 404 页面在 `(dashboard)` 组下显示 `DashboardSidebar`

### 7.3 页面功能无回归

- [ ] 首页 `/` 正常渲染，滚动时 header 样式变化正常
- [ ] `/explore` 筛选和歌曲网格正常
- [ ] `/songs`、`/albums`、`/lyrics` 列表加载正常
- [ ] `/settings` 邮箱修改、密码修改、账号删除功能正常
- [ ] `/login`、`/register` 表单提交正常
- [ ] `/dashboard` 统计数据和快捷操作正常

## 8. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 文件移动导致 import 路径断裂 | 低 | 中 | 移动后全面编译检查 `pnpm type-check` |
| git history 丢失 | 中 | 低 | 使用 `git mv` 移动文件，保留历史 |
| Route Group 导致 metadata 或 params 异常 | 低 | 中 | 确认 `generateMetadata` 和 `searchParams` 在移动后正常工作 |
| Layout 嵌套导致 CSS 类冲突 | 低 | 低 | 确认 `flex-1` 和 `min-h-screen` 层级正确 |

## 9. 验收标准

- [ ] 隐私政策、用户协议、联系页面添加顶部导航栏
- [ ] 404 页面增加返回首页链接和中文翻译
- [ ] 统一各页面导航布局（顶部 vs 侧边栏），settings 不再重复
- [ ] 所有现有 URL 保持不变，无 404 断裂
- [ ] `pnpm type-check` 通过
- [ ] `pnpm lint` 通过
- [ ] 构建通过 `pnpm build --filter web`
