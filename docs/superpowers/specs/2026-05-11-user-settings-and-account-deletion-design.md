# 用户设置与账户删除设计文档

> Issue: #60（改密/更邮）+ #63（级联删号）并案处理  
> 日期: 2026-05-11  
> 优先级: P1（公测合规底线）

---

## 1. 概述

### 1.1 并案背景

- **Issue #60** 规划了用户设置页（改密/更邮/删号入口），原定位为 P2（公测后迭代）。
- **Issue #63** 要求实现用户账户的级联数据删除，这是 GDPR 第 17 条和《个人信息保护法》的合规底线，定位为 P1（公测前必须完成）。
- 两个 issue 共享同一页面（`/settings`）和认证上下文，拆分会增加集成成本。
- **并案决策**：在 `/settings` 页面中同时实现改密、更邮和删号功能，一次性交付完整的用户账户管理模块。

### 1.2 范围

**本次实现（MVP）：**

| 功能 | 说明 |
|------|------|
| 修改密码 | 当前密码 + 新密码 + 确认新密码，含强度指示器 |
| 更新邮箱 | 新邮箱 + 当前密码验证，Supabase 自动发送验证邮件 |
| 删除账户 | 多级确认流程，级联清理全部用户数据 |

**明确排除（后续 issue 处理）：**

- Magic Link 用户的密码初始化流程（本 issue 中 Magic Link 用户无法删除账户，需等 issue #60 改密功能上线后）
- 定时清理残留的 Storage 文件（标记为可选增强）
- 审计日志表（issue 中标记为"可选"）
- 头像/昵称等 profile 字段编辑

### 1.3 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 删号技术方案 | PostgreSQL RPC + Next.js API Route | 数据库删除原子事务，与现有架构一致 |
| 密码验证方式 | `signInWithPassword` 原生验证 | 不处理密码哈希，安全合规 |
| Magic Link 用户删号 | 暂不支持 | 需先设置密码，改密功能在设置页中已规划 |
| Storage 删除失败处理 | 不阻断数据库事务，记录日志 | 文件可通过定时清理兜底 |

---

## 2. 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (/settings)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  修改密码表单  │  │  更新邮箱表单  │  │  删除账户 Dialog  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼──────────────────┼──────────┘
          │                 │                  │
          ▼                 ▼                  ▼
   supabase.auth      supabase.auth      POST /api/account/delete
   .signInWithPassword .updateUser        │
                                         ▼
                              ┌─────────────────────┐
                              │  Next.js API Route  │
                              │  1. 请求校验         │
                              │  2. 密码验证         │
                              │  3. 收集 Storage 路径│
                              │  4. 调用 RPC 删 DB   │
                              │  5. 清理 Storage     │
                              │  6. 删除 Auth 用户   │
                              └─────────────────────┘
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │  PostgreSQL RPC │    │  Supabase Auth  │
                    │ delete_user_data│    │ admin.deleteUser│
                    │  (原子事务)      │    │                 │
                    └─────────────────┘    └─────────────────┘
```

### 2.1 新增/修改文件清单

**数据库迁移：**
- `supabase-local/migrations/20260512000000_create_delete_user_data_function.sql`

**后端 API：**
- `apps/web/src/app/api/account/delete/route.ts`

**前端页面：**
- `apps/web/src/app/settings/page.tsx`

**前端组件：**
- `apps/web/src/components/settings/settings-section.tsx`
- `apps/web/src/components/settings/change-password-form.tsx`
- `apps/web/src/components/settings/update-email-form.tsx`
- `apps/web/src/components/settings/delete-account-dialog.tsx`

**共享包：**
- `packages/supabase/src/env.ts` — 暴露 service role key 配置
- `packages/supabase/src/server.ts` — 新增 `createServiceRoleClient()`

**i18n：**
- `apps/web/messages/zh.json` — 新增 `settings` 命名空间
- `apps/web/messages/en.json` — 新增 `settings` 命名空间

**测试：**
- `apps/web/src/app/api/account/delete/route.test.ts`
- `apps/web/tests/e2e/delete-account.spec.ts`

**环境变量：**
- `apps/web/.env.local.example` — 新增 `SUPABASE_SERVICE_ROLE_KEY`

---

## 3. 数据库设计

### 3.1 PostgreSQL RPC 函数

```sql
create or replace function public.delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  target_email text;
begin
  -- 获取用户邮箱（waitlist 清理需要）
  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'User not found';
  end if;

  -- 1. generation_tasks（可能引用 songs/albums，先删避免外键冲突）
  delete from generation_tasks where user_id = target_user_id;

  -- 2. songs（album_songs 的 song_id FK 是 on delete cascade，级联自动清理）
  delete from songs where user_id = target_user_id;

  -- 3. albums（album_songs 的 album_id FK 是 on delete cascade，级联自动清理）
  delete from albums where user_id = target_user_id;

  -- 4. lyrics（仅依赖 auth.users，独立删除）
  delete from lyrics where user_id = target_user_id;

  -- 5. waitlist（无 user_id 外键，按 email 匹配）
  delete from waitlist where email = target_email;
end;
$$;
```

### 3.2 删除顺序逻辑

| 步骤 | 表 | 原因 |
|-----|----|------|
| 1 | `generation_tasks` | 外键可能引用 `songs`/`albums`，先删避免 RESTRICT 冲突 |
| 2 | `songs` | `album_songs.song_id` 是 `on delete cascade`，级联清理关联 |
| 3 | `albums` | `album_songs.album_id` 是 `on delete cascade`，级联清理关联 |
| 4 | `lyrics` | 仅依赖 `auth.users`，无其他外键 |
| 5 | `waitlist` | 无 `user_id` 外键，按 `email` 匹配删除 |

### 3.3 不处理的表

| 表 | 原因 |
|----|------|
| `feedback` | `user_id` 已设 `on delete set null`，auth 用户删除后自动匿名化 |
| `rate_limits` | 无 `user_id` 字段，按 `key`（用户 ID 或 IP）记录 |
| `album_songs` | 两个外键均为 `on delete cascade`，父表删除时自动级联 |
| `auth.users` | 由 API Route 中的 `auth.admin.deleteUser()` 处理，不在 RPC 中 |

### 3.4 外键保护说明

- `songs.original_song_id`：`on delete set null` — 翻唱关联在删除时自动设为 NULL，正确保护其他用户的翻唱引用。
- 函数内部**不做 `auth.uid()` 检查** — API Route 已在调用前完成身份验证，且通过 service role client 调用时 `auth.uid()` 为 `null`。

---

## 4. API 设计

### 4.1 `POST /api/account/delete`

**请求格式：**
```json
{
  "confirmation": "DELETE",
  "password": "user's current password"
}
```

**响应码矩阵：**

| 状态码 | `error.code` | 触发条件 |
|-------|-------------|---------|
| `200` | — | 账户已成功删除 |
| `401` | `UNAUTHORIZED` | 未登录 |
| `400` | `VALIDATION_ERROR` | JSON 格式错误、缺少字段、`confirmation !== "DELETE"` |
| `403` | `PASSWORD_INCORRECT` | 当前密码验证失败 |
| `400` | `NO_PASSWORD_SET` | Magic Link 用户无密码 |
| `500` | `INTERNAL_ERROR` | 数据库 RPC 失败、Auth 删除失败 |

### 4.2 请求处理流程

```
POST /api/account/delete
│
├─ 1. 解析 JSON body，校验 confirmation === "DELETE"
│   └─ 否 → 400 VALIDATION_ERROR
│
├─ 2. 获取当前用户（createServerClient）
│   └─ 未登录 → 401 UNAUTHORIZED
│
├─ 3. 检查用户是否有密码（supabase.auth.signInWithPassword 尝试）
│   └─ 无密码（Magic Link 用户） → 400 NO_PASSWORD_SET
│
├─ 4. 密码验证（supabase.auth.signInWithPassword）
│   └─ 失败 → 403 PASSWORD_INCORRECT
│
├─ 5. 收集 Storage 路径（service role client 查询）
│   └─ songs.file_path, songs.cover_url, albums.cover_url
│
├─ 6. 调用 RPC: delete_user_data(user.id)
│   └─ 失败 → 500 INTERNAL_ERROR
│
├─ 7. 清理 Storage（逐个删除，失败不阻断）
│   └─ 记录错误日志
│
├─ 8. 删除 Auth 用户（service role client admin.deleteUser）
│   └─ 失败 → 500 INTERNAL_ERROR
│
└─ 9. 返回 200
```

### 4.3 Service Role Client

在 `packages/supabase/src/server.ts` 中新增：

```typescript
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseClientConfig()
  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
```

`SUPABASE_SERVICE_ROLE_KEY` 仅在服务端环境变量中配置，不暴露到浏览器。

---

## 5. 前端设计

### 5.1 页面布局（单页滚动）

```
┌──────────────────────────────────────────────┐
│  SiteHeader                                 │
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  设置                                │ │
│  │  user@example.com                     │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  📧 更新邮箱                          │ │
│  │  [新邮箱] [当前密码] [提交]            │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  🔒 修改密码                          │ │
│  │  [当前密码] [新密码] [确认密码] [提交] │ │
│  │  (密码强度指示器)                       │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  ⚠️ 危险区域                          │ │
│  │  ┌──────────────────────────────────┐ │ │
│  │  │  删除账户                        │ │ │
│  │  │  [点击弹出删除流程]               │ │ │
│  │  └──────────────────────────────────┘ │ │
│  └────────────────────────────────────────┘ │
│                                              │
└──────────────────────────────────────────────┘
```

### 5.2 组件设计

#### `settings-section.tsx`

通用区块容器：
- `title: string` — 区块标题
- `description?: string` — 区块描述
- `children: React.ReactNode` — 内容
- `variant?: 'default' | 'danger'` — danger 变体使用红色边框/底色警示

#### `change-password-form.tsx`

字段：当前密码、新密码、确认新密码  
新密码强度指示器复用注册页组件  
提交前先调用 `signInWithPassword` 验证当前密码，通过后调用 `supabase.auth.updateUser({ password })`  
成功 toast + 清空表单

#### `update-email-form.tsx`

字段：新邮箱、当前密码（security check）  
提交前先用 `signInWithPassword` 验证当前密码  
通过后调用 `supabase.auth.updateUser({ email })`  
Supabase 自动发送验证邮件到新邮箱  
成功 toast 提示"验证邮件已发送"

#### `delete-account-dialog.tsx`

多步 Dialog 状态机：`warn` → `verify` → `confirm` → `deleting` → `done`

| 步骤 | 内容 |
|------|------|
| `warn` | 警告信息：操作不可撤销，所有数据将被永久删除 |
| `verify` | 输入当前密码验证；检测 `NO_PASSWORD_SET` 时提示 Magic Link 用户先设密码 |
| `confirm` | 输入 `DELETE` 确认 |
| `deleting` | 加载状态："正在删除账户..." |
| `done` | 成功提示，清除 session，跳转首页 |

### 5.3 页面认证

`/settings` 使用已有 `AuthGuard` 组件 — 未登录用户自动重定向到 `/login?redirectTo=/settings`。

### 5.4 复用模式

| 模式 | 来源 |
|------|------|
| `react-hook-form` + `zodResolver` | 登录/注册表单 |
| `@kiyo/ui` 组件 | 全局组件库 |
| 密码强度指示器 | 注册页 |
| `useTransition` + `startTransition` | 密码登录表单 |
| `AuthGuard` | 登录/注册页 |

---

## 6. 数据流与错误处理

### 6.1 改密流程

```
用户提交表单
│
├─ 前端 zod 验证
│   ├─ 新密码 === 确认密码
│   ├─ 密码强度满足最低要求
│   └─ 新密码 !== 当前密码（可选校验）
│
├─ 调用 signInWithPassword(email, currentPassword) 验证当前密码
│   ├─ 失败 → toast.error "密码不正确"
│   └─ 成功 → 继续
│
├─ 调用 supabase.auth.updateUser({ password })
│   ├─ 成功 → toast.success + 清空表单
│   └─ 失败 → toast.error
```

### 6.2 更邮流程

```
用户提交表单
│
├─ 前端 zod 验证（邮箱格式、当前密码非空）
│
├─ 调用 signInWithPassword(email, currentPassword)
│   ├─ 失败 → toast.error "密码不正确"
│   └─ 成功 → 继续
│
├─ 调用 supabase.auth.updateUser({ email })
│   ├─ 成功 → toast "验证邮件已发送"
│   └─ 失败 → toast.error（邮箱已被占用等）
```

### 6.3 删号流程

```
用户点击「删除账户」→ 弹出 Dialog
│
├─ Step 1 (warn): 显示警告
│   └─ 用户点击「继续」→ Step 2
│
├─ Step 2 (verify): 输入当前密码
│   ├─ 调用 POST /api/account/delete
│   ├─ 400 NO_PASSWORD_SET → 提示 Magic Link 用户先设密码
│   ├─ 403 PASSWORD_INCORRECT → 提示密码错误，留在 Step 2
│   └─ 200 → Step 3
│
├─ Step 3 (confirm): 输入 DELETE
│   ├─ 再次调用 POST /api/account/delete (confirmation: "DELETE")
│   ├─ 200 → Step 4
│   └─ 500 → 显示「删除失败，请联系支持」
│
├─ Step 4 (deleting): 加载中
│
└─ Step 5 (done): 清除 session → 跳转 /
```

### 6.4 边界错误场景

| 场景 | 处理方式 |
|------|---------|
| 网络中断 | 前端 `try/catch` → toast.error |
| Auth 会话过期 | `updateUser` 返回 401 → toast 提示重新登录 |
| Storage 删除失败（RPC 成功但 Storage 失败） | API 返回 200，后台记录日志。残留文件由定时清理兜底 |
| Auth 用户删除失败（RPC 成功但 admin.deleteUser 失败） | API 返回 500，数据已清理但 auth 用户残留，需人工介入 |
| Magic Link 用户尝试删号 | Step 2 检测 `NO_PASSWORD_SET`，提示先设置密码 |

---

## 7. 安全考虑

### 7.1 密码验证
- 使用 `signInWithPassword` 原生验证，**后端不处理密码明文**，不比较密码哈希
- 改密、更邮、删号均需要先验证当前密码（security check），防止会话被盗用时的恶意操作

### 7.2 确认机制
- 删号 API 要求 `confirmation: "DELETE"`，防止误触发和 CSRF
- 更邮和删号需要当前密码重新验证（security check）

### 7.3 Service Role Key
- `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端环境变量中配置
- 通过 `createServiceRoleClient()` 工厂创建，配置 `autoRefreshToken: false, persistSession: false`
- **绝不暴露到浏览器或 API 响应中**

### 7.4 数据隔离
- RPC 函数使用 `security definer` 执行，以数据库所有者权限运行，不受 RLS 限制
- API Route 中先验证密码再调用 RPC，确保只有本人可操作

---

## 8. 测试策略

### 8.1 单元测试

**`packages/supabase/src/server.test.ts`（新增）：**
- `createServiceRoleClient()` 正确读取 `SUPABASE_SERVICE_ROLE_KEY`
- service role client 的 `autoRefreshToken: false, persistSession: false` 配置

### 8.2 API 路由测试

**`apps/web/src/app/api/account/delete/route.test.ts`（新增）：**

| 测试用例 | 期望 |
|---------|------|
| 未登录用户请求 | 401 UNAUTHORIZED |
| 缺少 `confirmation` 字段 | 400 VALIDATION_ERROR |
| `confirmation !== "DELETE"` | 400 VALIDATION_ERROR |
| Magic Link 用户（无密码） | 400 NO_PASSWORD_SET |
| 密码错误 | 403 PASSWORD_INCORRECT |
| 密码正确 + confirmation = "DELETE" | 200，验证 DB/Storage/Auth 均已清理 |
| Storage 删除失败（模拟） | 200 + 日志记录，DB 仍成功删除 |

使用 `vi.mock` mock Supabase 客户端的 `signInWithPassword`、`rpc`、`storage.from().remove()`、`admin.deleteUser()`。

### 8.3 E2E 测试

**`apps/web/tests/e2e/delete-account.spec.ts`（新增）：**

覆盖完整用户旅程：
1. 注册用户 → 登录 → 创建歌曲（带 audio 和 cover）→ 创建专辑
2. 进入 `/settings`
3. 修改密码（成功）
4. 更新邮箱（成功，验证邮件发送提示）
5. 删除账户（完整 Dialog 流程）
6. 验证跳转至首页
7. 尝试用旧凭据登录 → 失败
8. 验证数据库中无残留数据

### 8.4 前端组件测试（可选）

`delete-account-dialog.tsx` 的状态机可用 `@testing-library/react` 做交互测试。

---

## 9. i18n 设计

新增 `settings` 命名空间到 `messages/zh.json` 和 `messages/en.json`：

```json
{
  "settings": {
    "title": "设置",
    "emailSection": {
      "title": "更新邮箱",
      "description": "更改您的登录邮箱地址",
      "newEmail": "新邮箱",
      "currentPassword": "当前密码",
      "submit": "更新邮箱",
      "success": "验证邮件已发送至新邮箱，请查收"
    },
    "passwordSection": {
      "title": "修改密码",
      "description": "更新您的账户密码",
      "currentPassword": "当前密码",
      "newPassword": "新密码",
      "confirmPassword": "确认新密码",
      "submit": "修改密码",
      "success": "密码已更新"
    },
    "dangerZone": {
      "title": "危险区域",
      "description": "这些操作不可逆，请谨慎操作",
      "deleteAccount": {
        "title": "删除账户",
        "description": "永久删除您的账户及所有数据",
        "button": "删除账户",
        "dialog": {
          "warnTitle": "您确定要删除账户吗？",
          "warnDescription": "此操作将永久删除您的账户及所有数据，包括歌曲、专辑、歌词和上传的音频文件。此操作不可撤销。",
          "continue": "我已了解风险，继续",
          "verifyTitle": "验证密码",
          "verifyDescription": "请输入当前密码以验证身份",
          "confirmTitle": "确认删除",
          "confirmDescription": "请输入 DELETE 以确认永久删除账户",
          "confirmPlaceholder": "DELETE",
          "confirmButton": "永久删除账户",
          "deleting": "正在删除账户...",
          "success": "账户已成功删除",
          "noPassword": "您使用 Magic Link 登录，请先设置密码后再删除账户",
          "error": "删除失败，请稍后重试或联系支持"
        }
      }
    }
  }
}
```

---

## 10. 环境变量

### 10.1 新增

| 变量名 | 用途 | 位置 |
|--------|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端删除 auth 用户 | `apps/web/.env.local`（服务端 only） |

### 10.2 配置更新

`apps/web/.env.local.example` 新增：

```bash
# Supabase Service Role Key（仅服务端使用，用于删除账户）
SUPABASE_SERVICE_ROLE_KEY=
```

`packages/supabase/src/env.ts` 更新为：

```typescript
export function getSupabaseClientConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}
```

---

## 11. 后续可选增强（非 MVP）

1. **定时清理残留 Storage 文件** — 通过 `pg_cron` 或 Vercel Cron Job 定期清理 `storage.objects` 中 `auth.users` 不存在的用户目录
2. **审计日志表** — 记录账户删除操作（时间、用户 ID、操作人、结果）
3. **Magic Link 用户密码初始化** — 引导 Magic Link 用户在设置页设置初始密码
