# OAuth 社交登录配置指南

本文档说明如何在 Kiyo 项目中配置 GitHub 和 Google OAuth 登录。

## 前置条件

- 已创建 Supabase 项目
- 已设置 `NEXT_PUBLIC_SITE_URL` 环境变量

## 通用准备

1. 确认 `NEXT_PUBLIC_SITE_URL` 的值：
   - 本地开发：`http://localhost:3000`
   - 生产环境：`https://kiyo.wangyiyang.cc`
2. Supabase Auth 回调路径固定为：`/auth/callback`

## GitHub OAuth App 配置

1. 打开 GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. 填写应用信息：
   - **Application name**: Kiyo（或你喜欢的名称）
   - **Homepage URL**: `https://kiyo.wangyiyang.cc`
   - **Authorization callback URL**: `https://kiyo.wangyiyang.cc/auth/callback`
3. 创建后复制 **Client ID** 和 **Client Secret**
4. 打开 Supabase Dashboard → Authentication → Providers → GitHub
5. 启用 GitHub 并粘贴 Client ID 和 Client Secret
6. 保存

## Google Cloud Console 配置

1. 打开 [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. 点击 **Create Credentials** → **OAuth 2.0 Client ID**
3. 选择应用类型为 **Web application**
4. 填写名称（如 "Kiyo OAuth"）
5. 在 **Authorized redirect URIs** 中添加：
   ```
   https://<你的项目>.supabase.co/auth/v1/callback
   ```
   ‼️ 注意：这是 Supabase 的回调地址，不是前端地址。请替换 `<你的项目>` 为实际 Supabase Project Reference ID。
6. 创建后复制 **Client ID** 和 **Client Secret**
7. 打开 Supabase Dashboard → Authentication → Providers → Google
8. 启用 Google 并粘贴 Client ID 和 Client Secret
9. 保存

## 本地开发 vs 生产环境

| 环境 | NEXT_PUBLIC_SITE_URL | GitHub callback URL | Google redirect URI |
|---|---|---|---|
| 本地 | `http://localhost:3000` | `http://localhost:3000/auth/callback` | Supabase 地址不变 |
| 生产 | `https://kiyo.wangyiyang.cc` | `https://kiyo.wangyiyang.cc/auth/callback` | Supabase 地址不变 |

ℹ️ Google 的 redirect URI 始终指向 Supabase 服务端地址，不受前端域名影响。

GitHub 的 callback URL 需与前端域名一致，因此本地开发和生产需要分别配置，或在 GitHub OAuth App 中同时添加两个 callback URL。

## 验证

配置完成后：
1. 启动本地开发服务器：`pnpm --filter web dev`
2. 访问 `http://localhost:3000/login`
3. 点击 GitHub 或 Google 登录按钮
4. 完成授权后应成功登录并跳转回首页

## 常见问题

- **跳转地址错误**：检查 `NEXT_PUBLIC_SITE_URL` 是否设置正确
- **Provider 未启用**：确认 Supabase Dashboard 中对应 Provider 已开启
- **Callback 失败**：检查浏览器地址栏的 `?error=` 参数，或查看服务端日志
