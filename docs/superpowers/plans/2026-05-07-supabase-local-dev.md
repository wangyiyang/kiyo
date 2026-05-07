# Supabase 本地开发与共享 Client 封装实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化 Supabase 本地开发配置，创建 `packages/supabase` 共享 client 封装，并在 `apps/web` 中配置 session 刷新 middleware。

**Architecture:** 基于 `@supabase/ssr` 提供 cookie 感知的 browser/server client 封装，middleware 层统一处理 session 刷新，本地开发通过 `supabase/config.toml` link 到远程 Lichun 项目。

**Tech Stack:** Next.js 14, pnpm, Turborepo, @supabase/supabase-js, @supabase/ssr

---

### Task 1: 创建 packages/supabase 包结构与配置

**Files:**
- Create: `packages/supabase/package.json`
- Create: `packages/supabase/tsconfig.json`
- Create: `packages/supabase/index.ts`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@kiyo/supabase",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.49.4",
    "@supabase/ssr": "^0.6.1"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "noEmit": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*", "index.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 index.ts 入口文件**

```ts
export { createBrowserClient } from './src/client'
export { createServerClient } from './src/client'
export { updateSession } from './src/middleware'
```

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/
git commit -m "feat(supabase): initialize @kiyo/supabase package structure"
```

---

### Task 2: 实现 Browser/Server Client 封装

**Files:**
- Create: `packages/supabase/src/client.ts`

- [ ] **Step 1: 创建 client.ts**

```ts
import { createBrowserClient as createBrowser } from '@supabase/supabase-js'
import { createServerClient as createServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createBrowserClient() {
  return createBrowser(supabaseUrl, supabaseAnonKey)
}

export async function createServerClient() {
  const cookieStore = await cookies()

  return createServer(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Server Component 中无法设置 cookie，忽略
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Server Component 中无法删除 cookie，忽略
        }
      },
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/src/client.ts
git commit -m "feat(supabase): add browser and server client wrappers"
```

---

### Task 3: 实现 Middleware Session 刷新封装

**Files:**
- Create: `packages/supabase/src/middleware.ts`

- [ ] **Step 1: 创建 middleware.ts**

```ts
import { createServerClient } from '@supabase/ssr'
import { type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  // 刷新 session
  await supabase.auth.getSession()

  return supabaseResponse
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/src/middleware.ts
git commit -m "feat(supabase): add middleware session refresh helper"
```

---

### Task 4: 创建 apps/web middleware

**Files:**
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: 创建 middleware.ts**

```ts
import { updateSession } from '@kiyo/supabase'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(web): add Supabase session refresh middleware"
```

---

### Task 5: 初始化 Supabase 本地配置

**Files:**
- Create: `supabase/config.toml`

- [ ] **Step 1: 初始化 supabase 目录**

```bash
mkdir -p supabase
```

- [ ] **Step 2: 创建 config.toml**

```toml
# Supabase 本地开发配置
# 链接到远程项目 Lichun (ref: cgqorvwsnuiqtoxzwymr)

project_id = "cgqorvwsnuiqtoxzwymr"

[api]
port = 54321
schemas = ["public", "storage", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 17

[db.pooler]
enabled = false
port = 54329
pool_mode = "transaction"
default_pool_size = 20
max_client_conn = 100

[realtime]
enabled = true

[studio]
enabled = true
port = 54323
api_url = "http://127.0.0.1:54321"

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false

[edge_runtime]
enabled = true
policy = "permissive"
```

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat(supabase): add local dev config for Lichun project"
```

---

### Task 6: 创建环境变量模板

**Files:**
- Create: `.env.local.example`
- Create: `apps/web/.env.local.example`

- [ ] **Step 1: 创建根目录 .env.local.example**

```bash
cat > .env.local.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://cgqorvwsnuiqtoxzwymr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
```

- [ ] **Step 2: 创建 apps/web/.env.local.example**

```bash
cat > apps/web/.env.local.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://cgqorvwsnuiqtoxzwymr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
EOF
```

- [ ] **Step 3: Commit**

```bash
git add .env.local.example apps/web/.env.local.example
git commit -m "chore: add .env.local.example with Supabase variables"
```

---

### Task 7: 安装依赖并验证构建

**Files:**
- Modify: `apps/web/package.json`（添加 `@kiyo/supabase` 依赖）

- [ ] **Step 1: 修改 apps/web/package.json 添加 workspace 依赖**

在 `apps/web/package.json` 的 `dependencies` 中添加 `"@kiyo/supabase": "workspace:*"`。

修改后 dependencies 应如下：

```json
"dependencies": {
  "next": "^14.2.35",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "@kiyo/ui": "workspace:*",
  "@kiyo/supabase": "workspace:*"
}
```

- [ ] **Step 2: 安装依赖**

```bash
pnpm install
```

Expected: `packages/supabase/node_modules` 被创建，`@supabase/supabase-js` 和 `@supabase/ssr` 被安装。

- [ ] **Step 3: 运行类型检查**

```bash
pnpm type-check -- --filter=@kiyo/supabase
```

Expected: PASS，无类型错误。

- [ ] **Step 4: 运行 web 类型检查**

```bash
pnpm type-check -- --filter=web
```

Expected: PASS，无类型错误。

- [ ] **Step 5: Commit**

```bash
git add pnpm-lock.yaml apps/web/package.json
git commit -m "chore: install @kiyo/supabase dependencies and verify types"
```

---

### Task 8: 验证 Supabase 本地栈可启动

**Files:**
- 无新文件

- [ ] **Step 1: 检查 supabase CLI**

```bash
npx supabase --version
```

Expected: 输出版本号（如 `2.x.x`）。如果未安装，CLI 会自动下载。

- [ ] **Step 2: 启动本地栈**

```bash
npx supabase start
```

Expected: 本地 Supabase 服务启动成功，输出 API URL、DB URL、Studio URL 等信息。

- [ ] **Step 3: 停止本地栈**

```bash
npx supabase stop
```

- [ ] **Step 4: Commit（如有配置文件变更）**

如果 `supabase start` 生成了额外文件（如 `supabase/.temp/`），检查是否需要加入 `.gitignore`。

---

## 自审检查

### Spec 覆盖

| Spec 要求 | 对应 Task |
|-----------|----------|
| 初始化 supabase 配置（config.toml） | Task 5 |
| 创建 packages/supabase | Task 1, 2, 3 |
| createBrowserClient() 供前端使用 | Task 2 |
| createServerClient() 供 Server Component 使用 | Task 2 |
| middleware.ts 刷新 session | Task 3, 4 |
| .env.local.example 列出必需变量 | Task 6 |
| npx supabase start 可启动 | Task 8 |
| 类型安全 | Task 1 (tsconfig), Task 7 (type-check) |

### Placeholder 扫描

- 无 TBD/TODO
- 无 "implement later"
- 无 "add appropriate error handling"
- 所有代码完整

### 类型一致性

- `createBrowserClient` / `createServerClient` / `updateSession` 在 Task 1 index.ts 中的导出名与 Task 2、3 中的定义名一致
- 环境变量名 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 在所有文件中一致
