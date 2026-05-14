# OAuth 社交登录完善（Issue #126 收尾）

**日期:** 2026-05-14  
**状态:** 待审批  
**相关 Issue:** #126  
**前置设计:** [2026-05-12-oauth-login-design.md](./2026-05-12-oauth-login-design.md)

## 概述

基于已批准的 OAuth 登录基础实现，完成代码健壮性优化、用户体验增强和配置文档补充，确保 GitHub 与 Google 双 Provider 在生产环境稳定可用。

## 范围

本设计专注于以下三类收尾工作：
1. **文档补充（B）** — 环境变量示例、配置指南、项目文档更新
2. **代码审查优化（C）** — 错误处理、加载态、边界情况、可访问性
3. **配置相关调整（D）** — 确保 callback URL 与中间件路由规则兼容

## 代码优化

### 1. `apps/web/src/app/actions/auth.ts`

**问题:** `signInWithOAuth` 中 `NEXT_PUBLIC_SITE_URL` 缺少 fallback，与其他 action 不一致，本地开发时可能为 `undefined`。

**修改:**
- 将 `process.env.NEXT_PUBLIC_SITE_URL` 统一为 `process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'`，与 `signUp`、`sendMagicLink` 等保持一致。
- 添加 JSDoc 注释，说明函数直接 `throw`/`redirect`，不会返回 `AuthResult`。

```typescript
/**
 * 发起 OAuth 登录流程，直接重定向到 Provider 授权页。
 * 注意：此函数通过 `redirect()` 跳转，不会正常返回。
 */
export async function signInWithOAuth(
  provider: 'github' | 'google',
  next?: string
): Promise<never> {
  // ... 实现不变，仅修复 fallback
}
```

### 2. `apps/web/src/app/auth/callback/route.ts`

**问题:** 当前所有错误统一返回 `?error=callback_failed`，无法区分是 Supabase 配置问题、用户拒绝授权还是 code 缺失，增加排查难度。

**修改:**
- 区分三类错误，回传不同 query param：
  - `missing_code` — URL 无 code（用户手动访问 callback 或 Provider 异常）
  - `oauth_exchange_failed` — Supabase `exchangeCodeForSession` 失败（配置错误或 code 过期）
- 服务端打印结构化 `console.error`，包含具体 error message，便于 Vercel Log 排查。
- 保留 `next` 参数透传逻辑，OAuth 登录成功后仍回到原页面。

```typescript
if (!code) {
  console.error('[OAuth Callback] Missing authorization code')
  return NextResponse.redirect(`${origin}/login?error=missing_code`)
}

const { error } = await supabase.auth.exchangeCodeForSession(code)
if (error) {
  console.error('[OAuth Callback] Exchange failed:', error.message)
  return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`)
}
```

### 3. `apps/web/src/components/auth/oauth-buttons.tsx`

**问题:** 当前点击按钮后无反馈，网络延迟或跳转慢时用户可能重复点击；缺少无障碍状态标识。

**修改:**
- 使用 `useTransition` 包装点击事件，提供 `isPending` 状态。
- `pending` 时按钮设为 `disabled`，并添加 `aria-busy="true"`。
- 保持现有视觉：outline 变体、全宽、图标 + 文案。

```typescript
const [isPending, startTransition] = React.useTransition()

const handleGitHubSignIn = () => {
  startTransition(() => {
    signInWithOAuth('github', redirectTo)
  })
}
```

### 4. `apps/web/src/components/auth/login-form.tsx`

**问题:** OAuth 回调错误回传后，登录页无提示，用户不知道为什么回到了登录页。

**修改:**
- 使用 `useSearchParams` 读取 `?error=` 参数。
- 在表单顶部（OAuth 按钮上方）展示对应错误提示。
- 复用现有国际化翻译体系，新增 `auth.errors.oauthMissingCode` 和 `auth.errors.oauthExchangeFailed` 键。
- 错误提示采用简洁文本形式（非 toast），避免与密码登录的错误展示方式冲突。

```typescript
const searchParams = useSearchParams()
const oauthError = searchParams.get('error')
```

**新增翻译键（zh.json / en.json）:**
```json
"oauthMissingCode": "授权失败，请重试",
"oauthExchangeFailed": "登录验证失败，请检查配置或稍后重试"
```

## 文档补充

### 1. `apps/web/.env.local.example`

在 Supabase 配置区块上方新增注释：

```bash
# OAuth 社交登录
# 需在 Supabase Dashboard > Authentication > Providers 中开启对应 Provider
# GitHub: https://supabase.com/docs/guides/auth/social-login/auth-github
# Google: https://supabase.com/docs/guides/auth/social-login/auth-google
NEXT_PUBLIC_SITE_URL=https://kiyo.wangyiyang.cc
```

### 2. `README.md`（新增 OAuth 章节）

在项目根目录 `README.md` 的 "本地开发" 或 "部署" 附近新增：

```markdown
## OAuth 社交登录

本项目支持 GitHub 和 Google OAuth 登录。详细配置步骤请参阅 [docs/oauth-setup.md](docs/oauth-setup.md)。

环境要求：
- `NEXT_PUBLIC_SITE_URL` 必须设置为实际域名（本地开发用 `http://localhost:3000`）
- Supabase Dashboard 中已开启对应 Provider 并填写 Client ID / Secret
```

### 3. `docs/oauth-setup.md`（新建）

详细配置指南，包含：

- **通用准备**
  - 确认 `NEXT_PUBLIC_SITE_URL` 环境变量
  - 确认 Supabase Project URL 和 Callback 路径：`/auth/callback`

- **GitHub OAuth App 配置**
  1. GitHub Settings > Developer settings > OAuth Apps > New OAuth App
  2. Authorization callback URL: `https://<你的域名>/auth/callback`
  3. 复制 Client ID 和 Client Secret
  4. 填入 Supabase Dashboard > Authentication > Providers > GitHub

- **Google Cloud Console 配置**
  1. Google Cloud Console > APIs & Services > Credentials > Create OAuth 2.0 Client
  2. Authorized redirect URIs: `https://<你的项目>.supabase.co/auth/v1/callback`
  3. 复制 Client ID 和 Client Secret
  4. 填入 Supabase Dashboard > Authentication > Providers > Google

- **本地开发 vs 生产环境**
  - 本地 callback URL: `http://localhost:3000/auth/callback`
  - 生产 callback URL: `https://kiyo.wangyiyang.cc/auth/callback`
  - Supabase Dashboard 中可配置多个 redirect URL（或单独建测试 Project）

## 配置兼容性验证（D）

### 中间件路由检查

需确认 `apps/web/src/middleware.ts` 的 `matcher` 不会将 `/auth/callback` 请求重写到带 locale 前缀的路径。

**验证逻辑:**
- 当前 `auth/callback/route.ts` 位于 `/app/auth/callback`，**不在** `[locale]` 路由组下，属于 root-level route。
- next-intl middleware 默认会跳过非 `[locale]` 路径的匹配，但需要确认 `matcher` 配置中未误拦截 `/auth/*`。
- 若 middleware 中显式排除了 `/auth/callback`，则无需改动；若未排除且发现请求被异常添加 locale，则需在 matcher 中补充排除规则。

**结论:** `middleware.ts` 的 `matcher` 已包含 `(?!api|auth|...)` 否定前瞻，`/auth/callback` 不会被 next-intl 重写，无需修改。

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `apps/web/src/app/actions/auth.ts` | 修改 | 修复 SITE_URL fallback，添加 JSDoc |
| `apps/web/src/app/auth/callback/route.ts` | 修改 | 细化错误码、添加服务端日志 |
| `apps/web/src/components/auth/oauth-buttons.tsx` | 修改 | 添加 useTransition 加载态、aria-busy |
| `apps/web/src/components/auth/login-form.tsx` | 修改 | 读取并展示 OAuth 回调错误 |
| `apps/web/messages/zh.json` | 修改 | 新增 oauthMissingCode / oauthExchangeFailed |
| `apps/web/messages/en.json` | 修改 | 新增 oauthMissingCode / oauthExchangeFailed |
| `apps/web/.env.local.example` | 修改 | 补充 OAuth 环境变量注释 |
| `README.md` | 修改 | 新增 OAuth 章节 |
| `docs/oauth-setup.md` | 新增 | 详细配置指南 |
| `apps/web/src/middleware.ts` | 无需修改（已验证） | matcher 已排除 `/auth/*`，callback 不受 locale 重写影响 |

## 成功标准

1. 本地开发时 `NEXT_PUBLIC_SITE_URL` 未设置不会导致 OAuth 跳转地址异常。
2. 用户点击 OAuth 按钮后，pending 状态下按钮不可再次点击，屏幕阅读器播报 busy 状态。
3. OAuth 回调失败时，用户回到登录页能看到具体错误原因（非统一的 "callback_failed"）。
4. Vercel Log 中可通过 `[OAuth Callback]` 前缀快速检索到服务端错误详情。
5. 新团队成员可通过 `docs/oauth-setup.md` 独立完成 GitHub/Google Provider 配置。
6. `/auth/callback` 请求不被 next-intl middleware 添加 locale 前缀。

## 依赖

- Supabase Dashboard 已配置 GitHub Provider（P0，issue 中已确认）
- Supabase Dashboard 已配置 Google Provider（P1，用户确认双 Provider 可用）
- `NEXT_PUBLIC_SITE_URL` 在生产环境已设置为 `https://kiyo.wangyiyang.cc`
