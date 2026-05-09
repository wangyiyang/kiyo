# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 项目背景、技术栈概览和快速开始指南请参阅 [README.md](./README.md)。本文档聚焦开发规范、架构细节和 Agent 操作指南。

## Monorepo 结构

仓库采用 Monorepo 模式组织，预期目录结构如下：

```
kiyo/
├── apps/
│   └── web/                 # Next.js 前端应用
├── packages/
│   ├── ui/                  # shadcn/ui 组件库封装（共享 UI）
│   ├── shared/              # 共享类型、工具函数
│   ├── supabase/            # Supabase client 封装、schema 类型
│   ├── eslint-config/       # 共享 ESLint 配置
│   └── typescript-config/   # 共享 TypeScript 配置
├── supabase-local/
│   └── migrations/          # 数据库迁移文件
├── package.json             # workspace root 配置
├── pnpm-workspace.yaml      # pnpm workspace 定义
└── turbo.json               # Turborepo 任务编排
```

### 包管理器

- 使用 **pnpm** + **Turborepo**
- `package.json` 中声明 `"packageManager": "pnpm@9.x.x"`
- `pnpm-workspace.yaml`：
  ```yaml
  packages:
    - apps/*
    - packages/*
  ```

## 开发命令

### 根目录命令

```bash
# 安装所有 workspace 依赖
pnpm install

# 启动前端开发服务器
pnpm dev

# 构建所有应用和包
pnpm build

# 类型检查
pnpm type-check

# 代码检查
pnpm lint

# 运行测试
pnpm test
```

### 单应用/单包命令

使用 Turborepo filter 运行特定 workspace 的命令：

```bash
# 仅运行 web 应用的 dev
pnpm dev -- --filter=web

# 仅构建 ui 包
pnpm build -- --filter=@kiyo/ui

# 仅对 web 运行类型检查
pnpm type-check -- --filter=web

# 仅运行 web 的测试
pnpm test -- --filter=web
```

### shadcn/ui 组件管理

在 `packages/ui` 目录下操作 shadcn 组件：

```bash
cd packages/ui

# 添加新组件
npx shadcn add <component-name>

# 例如
npx shadcn add button
```

添加后确保在 `packages/ui` 的 `index.ts` 中导出，供 `apps/web` 引用。

### Supabase 本地开发

```bash
# 启动本地 Supabase 栈
pnpm supabase:start

# 查看本地服务状态
pnpm supabase:status

# 创建新的数据库迁移
npx supabase --workdir supabase-local db diff -f <migration-name>

# 应用迁移到本地
pnpm supabase:db:reset

# 生成 TypeScript 类型（基于本地 schema）
pnpm supabase:gen:types
```

### 数据库迁移规范

- 所有 schema 变更必须通过迁移文件（`supabase-local/migrations/`）管理
- 本地开发完成后，使用 `supabase db diff` 生成迁移
- 迁移文件命名规范：`YYYYMMDDHHMMSS_description.sql`
- 合并到 `main` 前确保迁移可以干净地运行在最新 schema 上

### 测试命令

```bash
# 运行所有测试
pnpm test

# 仅运行 web 应用的测试
pnpm test -- --filter=web

# 仅运行 ui 包的测试
pnpm test -- --filter=@kiyo/ui

# 运行单个测试文件
pnpm test -- --filter=web -- src/components/Button.test.tsx

# 运行 E2E 测试（Playwright）
pnpm exec playwright test
```

## 技术栈约束

### Next.js 定位

- `apps/web` 是**前端应用**，负责 UI 渲染、用户交互、路由、BFF API Routes
- 核心业务逻辑（AI 推理、音频处理、长耗时任务）如果超出 Supabase Edge Functions 的能力范围，应独立为 `apps/api`
- 使用 App Router（`app/` 目录），不使用 Pages Router
- API 路由优先使用 Next.js Route Handlers（`app/api/`）
- 服务端数据获取使用 Server Components + Supabase server client

### shadcn/ui

- UI 组件统一从 `packages/ui` 导出，禁止在 `apps/web` 中直接安装 shadcn 组件
- 自定义组件基于 shadcn 组件进行二次封装，也放在 `packages/ui`
- 主题配置（colors、radius 等）在 `packages/ui` 的 `tailwind.config.ts` 中管理
- `apps/web/tailwind.config.ts` 的 `content` 必须包含 `packages/ui` 的路径：
  ```ts
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ]
  ```
- `packages/ui` 需导出 `cn()` 工具函数（基于 `clsx` + `tailwind-merge`）

### Supabase

- 数据库操作统一使用 `packages/supabase` 中封装的 client
- 前端使用 `createBrowserClient`，服务端使用 `createServerClient`
- `apps/web/middleware.ts` 负责刷新 Supabase session 和保护路由
- 对象存储（Storage）用于音频文件、封面图等资源
- RLS（Row Level Security）策略必须显式配置，禁止默认开放

### 环境变量

- 根目录提供 `.env.local.example`，列出所有必需变量
- 本地开发使用 `apps/web/.env.local`（已加入 `.gitignore`）
- Vercel 部署时，不同环境（Production / Preview / Development）在 dashboard 中分别配置
- 不提交任何 `.env` 文件到仓库

### 共享配置

- `packages/eslint-config` 和 `packages/typescript-config` 提供统一的 lint 和 ts 配置
- `apps/web` 和 `packages/ui` 统一引用共享配置，不各自维护独立配置

## 业务架构

核心功能（专辑管理、封面生成、歌词管理）的详细数据模型、业务流程和 API 设计请参阅 [`docs/architecture.md`](./docs/architecture.md)。
