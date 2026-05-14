# Issue #174 未登录用户访问个人页面鉴权统一设计

## 背景与问题

生产环境验证发现，未登录用户可以直接访问多个个人/账号页面，鉴权边界不一致：

- `/songs`、`/lyrics`、`/albums`：无鉴权守卫，直接展示空态和创建入口
- `/settings`：已用 `RequireAuth` 但缺少 `redirectTo`，登录后无法返回
- `/songs/new`：正确使用 `RequireAuth` + `redirectTo`，跳转登录后可返回
- 部分详情页（`/songs/[id]`、`/albums/[id]`、`/lyrics/[id]`、`/dashboard`）已用 `RequireAuth` 但同样缺少 `redirectTo`

这是访问控制和用户信任问题。即使 API 有服务端保护，匿名用户看到账号设置/危险区域表单仍会造成安全感知问题。

## 目标

1. 未登录用户访问所有个人内容页和账号设置页时，统一跳转登录页并保留 `redirectTo`
2. 登录后可回到原始页面
3. 不改变公开分享页（`/songs/[id]/public`、`/albums/[id]/public`）的可访问性
4. 鉴权策略在所有页面之间保持一致

## 方案选择

- **方案 A：在 layout 加鉴权** — 不可行，因为 `/songs/[id]/public` 和 `/albums/[id]/public` 共享父级 layout，会误拦截公开页。
- **方案 B：每个 page.tsx 单独加鉴权** — ✅ 推荐。与现有 `/songs/[id]/page.tsx`、`/songs/new/layout.tsx` 的 patterns 保持一致，粒度精确，不影响公开分享页。
- **方案 C：Middleware 统一拦截** — 过度设计，需要维护路由白名单/黑名单，与现有 `RequireAuth` 组件重复，改动面太大。

## 实现范围

### 1. 补传 `redirectTo`（8 个文件）

对已在 server component 中使用 `RequireAuth` 但未传 `redirectTo` 的页面，补传当前路径：

| 文件 | 当前 `redirectTo` | 应改为 |
|------|------------------|--------|
| `app/[locale]/settings/page.tsx` | 无（默认 `/login`） | `/login?redirectTo=/settings` |
| `app/[locale]/dashboard/page.tsx` | 无（默认 `/login`） | `/login?redirectTo=/dashboard` |
| `app/[locale]/songs/[id]/page.tsx` | 无（默认 `/login`） | `/login?redirectTo=/songs/{id}` |
| `app/[locale]/albums/[id]/page.tsx` | 无（默认 `/login`） | `/login?redirectTo=/albums/{id}` |
| `app/[locale]/lyrics/[id]/page.tsx` | 无（默认 `/login`） | `/login?redirectTo=/lyrics/{id}` |
| `app/[locale]/songs/[id]/edit/layout.tsx` | 无（默认 `/login`） | `/login?redirectTo=/songs/{id}/edit` |
| `app/[locale]/lyrics/[id]/edit/layout.tsx` | 无（默认 `/login`） | `/login?redirectTo=/lyrics/{id}/edit` |
| `app/[locale]/songs/cover/layout.tsx` | 无（默认 `/login`） | `/login?redirectTo=/songs/cover` |

> 注：对于含动态段的路由，`redirectTo` 中动态段需从 `params` 读取后拼接。

### 2. 列表页添加鉴权（3 个 page + 3 个提取的 client 组件）

`songs/page.tsx`、`lyrics/page.tsx`、`albums/page.tsx` 当前是 `'use client'` 组件，无法直接使用 server-side 的 `RequireAuth`。将其重构为 server component wrapper：

```
page.tsx          → server component，包裹 RequireAuth，传入 redirectTo
├── xxx-list.tsx  → 提取的原 'use client' 列表逻辑
```

具体：
- `app/[locale]/songs/page.tsx` → server wrapper + `songs-list.tsx`
- `app/[locale]/lyrics/page.tsx` → server wrapper + `lyrics-list.tsx`
- `app/[locale]/albums/page.tsx` → server wrapper + `albums-list.tsx`

每个提取的组件放在对应目录下（`_components/songs-list.tsx` 或直接同级），保持原有 hooks 和交互逻辑不变。

### 3. 公开分享页确认不受影响

以下页面**不**在本次改动范围内（它们共享父级 layout 或自身就是公开页）：
- `/songs/[id]/public`
- `/albums/[id]/public`

## 鉴权组件现状

`RequireAuth` 已统一（来自 issue #160 / PR #181），签名：

```tsx
interface RequireAuthProps {
  children: React.ReactNode
  redirectTo?: string  // 默认 '/login'
}
```

它通过 `createServerClient` 获取当前用户，未登录时 `redirect(redirectTo)`。它是 async server component，可直接在 server page/layout 中使用。

## 路由鉴权状态（改动后）

| 路由 | 鉴权方式 | redirectTo |
|------|---------|-----------|
| `/songs` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/songs` |
| `/lyrics` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/lyrics` |
| `/albums` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/albums` |
| `/settings` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/settings` |
| `/dashboard` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/dashboard` |
| `/songs/[id]` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/songs/{id}` |
| `/albums/[id]` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/albums/{id}` |
| `/lyrics/[id]` | `page.tsx` 中 `RequireAuth` | `/login?redirectTo=/lyrics/{id}` |
| `/songs/new` | `layout.tsx` 中 `RequireAuth` | `/login?redirectTo=/songs/new` ✅ 已有 |
| `/lyrics/new` | `layout.tsx` 中 `RequireAuth` | `/login?redirectTo=/lyrics/new` ✅ 已有 |
| `/songs/[id]/edit` | `layout.tsx` 中 `RequireAuth` | `/login?redirectTo=/songs/{id}/edit` |
| `/lyrics/[id]/edit` | `layout.tsx` 中 `RequireAuth` | `/login?redirectTo=/lyrics/{id}/edit` |
| `/songs/cover` | `layout.tsx` 中 `RequireAuth` | `/login?redirectTo=/songs/cover` |
| `/songs/[id]/public` | ❌ 无鉴权 | N/A（公开页） |
| `/albums/[id]/public` | ❌ 无鉴权 | N/A（公开页） |

## 测试策略

1. **手动验证**：以未登录会话访问 `/songs`、`/lyrics`、`/albums`、`/settings`，确认均跳转 `/login?redirectTo=...`
2. **手动验证**：登录后确认被重定向回原始页面
3. **手动验证**：确认 `/songs/[id]/public` 仍可未登录访问
4. **单元测试**：如需要，可为提取的列表组件补充快照/渲染测试（现有 page 无测试，非必须）
5. **TypeScript**：运行 `pnpm type-check` 确认无类型错误

## 风险与回退

- **风险**：提取 'use client' 列表组件时可能遗漏 import 或 props
- **缓解**：保持提取组件与原始 page 完全一致，仅移动代码；TypeScript 编译验证
- **回退**：git revert 即可恢复
