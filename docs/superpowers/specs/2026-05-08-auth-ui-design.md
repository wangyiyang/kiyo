# 用户认证 UI 设计文档

> Issue: #34 / #35 — 添加用户登录/注册/登出 UI
> Date: 2026-05-08

---

## 1. 背景与目标

当前 Kiyo 的 Supabase Auth 基础设施（`packages/supabase` client、middleware session 刷新）已就绪，但前端完全没有登录/注册 UI。用户数据表（`albums`、`songs`、`lyrics`）均已预留 `user_id` 字段，认证 UI 是实现用户数据隔离的前提。

**目标**：提供完整的登录/注册/登出 UI 流程，支持邮箱+密码和 Magic Link 两种登录方式。

---

## 2. 认证方式

| 方式 | 状态 | 说明 |
|------|------|------|
| 邮箱 + 密码 | ✅ 实现 | 主登录方式 |
| Magic Link（无密码邮件登录） | ✅ 实现 | 通过链接切换，在同一登录页面内 |
| OAuth（Google / GitHub） | ❌ 暂不实现 | UI 不预留占位，后续如需添加可独立扩展 |

---

## 3. 路由设计

| 路由 | 用途 | 访问控制 |
|------|------|----------|
| `/login` | 登录页面（密码 / Magic Link 切换） | 已登录用户 → 重定向到首页 `/` |
| `/register` | 注册页面 | 已登录用户 → 重定向到首页 `/` |
| `/forgot-password` | 请求密码重置邮件 | 已登录用户 → 重定向到首页 `/` |
| `/auth/callback` | Magic Link / 邮箱验证后的回调路由 | 无需登录，处理 session 后重定向 |
| `/reset-password` | 通过邮件链接设置新密码 | 无需登录，需带 `code` 参数 |

**智能重定向**：登录/注册成功后，优先跳转到用户之前试图访问的受保护页面（通过 `redirectTo` 查询参数传递），否则回到首页 `/`。

---

## 4. 页面交互设计

### 4.1 登录页面 (`/login`)

**默认模式：密码登录**

```
┌─────────────────────────────────┐
│           登录 Kiyo              │
│                                 │
│  [  邮箱输入框  ]               │
│                                 │
│  [  密码输入框  ]               │
│    [ ] 显示密码 (眼睛图标)       │
│    [ ] 记住我                   │
│                                 │
│         [  登录  ]              │
│                                 │
│  或使用 Magic Link              │
│                                 │
│  还没有账号？ [去注册]            │
│  忘记密码？ [找回密码]            │
└─────────────────────────────────┘
```

**Magic Link 模式**（点击链接切换，无页面跳转）：
- 隐藏密码输入框，仅保留邮箱 + "发送登录链接" 按钮
- 调用 `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })`
- `emailRedirectTo` 指向一个 `/auth/callback` 路由处理器，由该处理器读取 session 后重定向到目标页面
- 发送成功后显示"已发送，请查收邮件"
- 提供链接返回密码登录模式

**错误处理**：
- 邮箱未注册 → "该邮箱尚未注册"
- 密码错误 → "密码错误，请重试"
- 邮箱未验证 → "请先验证邮箱，已重新发送验证邮件"

### 4.2 注册页面 (`/register`)

```
┌─────────────────────────────────┐
│          注册 Kiyo               │
│                                 │
│  [  邮箱输入框  ]               │
│                                 │
│  [  密码输入框  ]               │
│  密码强度: ██████░░░░  弱       │
│                                 │
│  [  确认密码  ]                 │
│                                 │
│         [  注册  ]              │
│                                 │
│  已有账号？ [去登录]            │
└─────────────────────────────────┘
```

**交互细节**：
- 密码实时验证（Supabase 默认要求至少 6 位）
- 密码强度指示器：4 级（弱/中/强/极强），基于长度 + 字符类型
- 确认密码不一致时实时提示
- 注册成功后自动发送验证邮件（Supabase 默认行为）
- 注册成功 toast → 自动跳转到 `/login`，并提示"请查收验证邮件"
- **必须验证邮箱后才能登录**（Supabase `email_confirm` 配置）

### 4.3 忘记密码页面 (`/forgot-password`)

- 仅邮箱输入框 + "发送重置邮件" 按钮
- 发送成功后显示"请查收邮件重置密码"
- 无论邮箱是否注册，都显示相同提示（防止邮箱枚举）

### 4.4 重置密码页面 (`/reset-password`)

- 仅可通过邮件中的链接访问（带 `code` 查询参数）
- 新密码输入框 + 确认密码输入框
- 页面加载时调用 `supabase.auth.exchangeCodeForSession(code)` 验证 OTP 并建立 session
- 新密码输入框 + 确认密码输入框
- 提交后调用 `supabase.auth.updateUser({ password: newPassword })`
- 成功 toast → 自动跳转到 `/login`

---

## 5. Header 用户状态

### 5.1 未登录状态

- 替换现有的 "加入等待列表" CTA 按钮为 **"登录"** 按钮
- 点击跳转到 `/login`
- 保留 LocaleSwitcher 和 ThemeToggle

### 5.2 已登录状态

- 显示用户头像（Avatar）+ 下拉菜单触发器
- 无自定义头像时显示邮箱首字母 + 背景色（shadcn Avatar fallback）
- 下拉菜单内容：
  - 用户邮箱（灰色不可点击）
  - 分隔线
  - 我的歌曲 → `/songs`（当前为全量列表，后续用户中心功能再加过滤）
  - 我的专辑 → `/albums`
  - 我的歌词 → `/lyrics`
  - 分隔线
  - 设置
  - 退出登录

**退出登录**：调用 `supabase.auth.signOut()`，成功后刷新页面（`router.refresh()`）。

---

## 6. 组件拆分

| 组件 | 位置 | 职责 |
|------|------|------|
| `LoginForm` | `app/login/page.tsx` | 登录页面主组件，管理密码/Magic Link 切换 |
| `PasswordLoginForm` | `components/auth/password-login-form.tsx` | 密码登录子表单 |
| `MagicLinkForm` | `components/auth/magic-link-form.tsx` | Magic Link 子表单 |
| `RegisterForm` | `app/register/page.tsx` | 注册页面主组件 |
| `ForgotPasswordForm` | `app/forgot-password/page.tsx` | 忘记密码页面 |
| `ResetPasswordForm` | `app/reset-password/page.tsx` | 重置密码页面 |
| `UserMenu` | `components/auth/user-menu.tsx` | Header 用户头像下拉菜单 |
| `AuthGuard` | `components/auth/auth-guard.tsx` | 受保护路由守卫（可选，当前页面保持开放） |

---

## 7. 状态管理

- **不引入全局状态管理库**（Zustand / Redux / Context），SiteHeader 组件内部自行管理登录状态
- 在 `SiteHeader` 中使用 `useEffect` + `supabase.auth.onAuthStateChange` 监听登录状态变化
- 首次渲染时通过 Server Component (`createServerClient`) 获取当前用户，避免水合闪烁
- Client Component 中用 `createBrowserClient` 获取 supabase 实例并监听 auth 事件

---

## 8. 错误处理

| 场景 | 处理 |
|------|------|
| 邮箱未注册 | 提示"该邮箱尚未注册，是否去注册？" |
| 密码错误 | 提示"密码错误" |
| 邮箱未验证 | 提示"请先验证邮箱"，提供重新发送邮件按钮 |
| Magic Link 已过期 | 提示"链接已过期，请重新发送" |
| 网络错误 | 通用 toast 错误提示 |
| 环境变量缺失 | 登录页面显示"认证服务暂不可用" |

---

## 9. 国际化 (i18n)

- 所有认证相关文案使用 `next-intl` 翻译
- 新增命名空间：`auth`（`messages/en.json` 和 `messages/zh.json`）
- 翻译键：
  - `auth.login.title`, `auth.login.email`, `auth.login.password`, `auth.login.submit` ...
  - `auth.register.title`, `auth.register.passwordStrength.*` ...
  - `auth.errors.*` ...

---

## 10. 安全考量

1. **密码强度**：前端实时检查 + Supabase 后端最低要求（6位）
2. **邮箱验证**：注册后必须验证邮箱才能登录
3. **CSRF**：Supabase SSR 客户端自动处理
4. **重放攻击**：Magic Link 一次性使用，有有效期
5. **邮箱枚举**：忘记密码页面无论邮箱是否存在都返回相同提示
6. **XSS**：表单数据通过 Zod 校验，不直接渲染用户输入

---

## 11. 依赖

无需新增 npm 依赖，全部使用现有技术栈：
- `@supabase/ssr` — 已安装
- `@supabase/supabase-js` — 已安装
- `next-intl` — 已安装
- `react-hook-form` + `zod` + `@hookform/resolvers` — 已安装（waitlist 表单在用）
- shadcn/ui 组件 — 已安装

---

## 12. 非目标（YAGNI）

以下功能**明确不在本次实现范围内**：
- OAuth 第三方登录
- 用户资料编辑页（头像上传、昵称修改等）
- 多因素认证 (MFA)
- 社交登录绑定/解绑
- 用户角色/权限管理（超出 Supabase Auth 范围）
- 受保护路由强制登录（当前所有页面保持开放，仅关联 `user_id`）
