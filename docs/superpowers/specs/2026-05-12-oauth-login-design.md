# OAuth 社交登录设计

**日期:** 2026-05-12  
**状态:** 已批准  
**相关 Issue:** #126

## 概述

为 Kiyo 添加 GitHub 和 Google OAuth 登录方式，绕过邮件 rate limit 限制，提升注册转化率。

## 设计决策

1. **登录页 + 注册页都加 OAuth** - 一次实现全覆盖
2. **OAuth 按钮放在密码登录上方** - 更醒目，引导用户优先使用
3. **自动创建用户名** - 用 OAuth 返回的 name 或 email 前缀
4. **无需补充信息页** - 用户名自动生成，减少注册摩擦

## UI 布局

```
┌─────────────────────────────────┐
│  GitHub 登录 (主要)              │
│  Google 登录                    │
├─────────────────────────────────┤
│           或                    │
├─────────────────────────────────┤
│  密码登录表单                   │
└─────────────────────────────────┘
```

- OAuth 按钮全宽
- 分隔线 + "或" 文案
- 移动端自适应

## 实现要点

### 1. 后端 Action

文件: `apps/web/src/app/actions/auth.ts`

```typescript
export async function signInWithOAuth(provider: 'github' | 'google'): Promise<never> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })
  if (data.url) redirect(data.url)
  // 错误处理
}
```

### 2. 登录/注册页

文件: 
- `apps/web/src/components/auth/login-form.tsx`
- `apps/web/src/components/auth/register-form.tsx` (如存在)

新增 `OAuthButtons` 组件，放置在表单上方。

### 3. Auth Callback 页面

确认 `apps/web/src/app/auth/callback/route.ts` 正确处理 OAuth 回调，默认跳转到首页。

## 成功标准

1. 点击 GitHub 按钮 → 跳转到 GitHub 授权 → 回调后登录成功
2. 点击 Google 按钮 → 跳转到 Google 授权 → 回调后登录成功
3. 新用户 OAuth 登录后自动创建账户并登录
4. 已存在账户的 OAuth 登录（相同邮箱）直接登录

## 依赖

- Supabase Dashboard 已配置 GitHub Provider
- Supabase Dashboard 已配置 Google Provider (Client ID/Secret 已填)
- 环境变量 `NEXT_PUBLIC_SITE_URL=https://kiyo.wangyiyang.cc`