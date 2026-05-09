# Supabase 本地开发与共享 Client 封装设计

## 目的

为 Kiyo 项目配置 Supabase 本地开发环境，创建共享的 `packages/supabase` client 封装包，并在 `apps/web` 中配置 middleware 以刷新 Supabase session。

## 背景

- 现有 Supabase 远程项目：**Lichun**（ref: `cgqorvwsnuiqtoxzwymr`，region: `ap-southeast-1`）
- 项目为 Next.js 14 + pnpm monorepo，尚无 Supabase 相关配置
- 需要同时支持本地开发和远程开发两种模式

## 方案

### 目录结构

```
packages/supabase/
├── package.json          # 依赖 @supabase/supabase-js + @supabase/ssr
├── tsconfig.json         # 引用根目录共享 tsconfig
├── src/
│   ├── client.ts         # createBrowserClient() + createServerClient()
│   └── middleware.ts     # 供 apps/web 使用的 updateSession 封装
└── index.ts              # 统一导出

apps/web/
├── middleware.ts         # 调用 packages/supabase 的 updateSession
└── .env.local.example    # 环境变量模板

supabase-local/
└── config.toml           # 本地开发配置，project_id = cgqorvwsnuiqtoxzwymr

.env.local.example        # 根目录，列出所有 workspace 必需变量
```

### packages/supabase 封装

#### client.ts

- `createBrowserClient()`：基于 `@supabase/supabase-js`，读取 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `createServerClient()`：基于 `@supabase/ssr`，支持 cookie 读写，供 Server Component / API Route 使用

#### middleware.ts

- `updateSession(request)`：封装 middleware 中 session 刷新逻辑
- 自动处理 cookie 的 set/remove
- 返回 `NextResponse`，供 `apps/web/middleware.ts` 直接使用

### apps/web/middleware.ts

- 匹配 `/` 下所有路由（`matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`）
- 调用 `updateSession` 刷新 Supabase session
- 使用 `NextResponse.next()` 透传，不阻塞页面加载

### 环境变量

根目录 `.env.local.example`：

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

本地开发时复制为 `apps/web/.env.local` 填入真实值。publishable key（`sb_publishable_...`）和 legacy anon key 都支持，默认使用 publishable key。

### 本地开发工作流

```bash
# 启动本地 Supabase 栈（link 到 Lichun 项目）
pnpm supabase:start

# 生成类型（基于远程 schema）
npx supabase gen types typescript --project-id cgqorvwsnuiqtoxzwymr > packages/supabase/src/database.types.ts
```

## 影响与风险

- `apps/web` 新增 `middleware.ts` 后，Next.js 会自动加载，需确保不影响现有页面性能
- `packages/supabase` 被 `apps/web` 依赖后，会增加约 50KB（gzip）的 bundle 体积
- 环境变量缺失会导致 build/runtime 报错，需确保 `.env.local.example` 文档清晰

## 验收标准

- [ ] `pnpm supabase:start` 可启动本地 Supabase 栈
- [ ] `packages/supabase` 可导出类型安全的 client
- [ ] middleware 可正常刷新 session 且不影响页面加载性能
