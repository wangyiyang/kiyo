# Next.js + shadcn/ui + Tailwind CSS 初始化设计文档

> **关联 Issue:** [#2 [Setup] Set up Next.js app with shadcn/ui and Tailwind CSS](https://github.com/wangyiyang/kiyo/issues/2)

---

## 目的

在已有的 monorepo 底座（pnpm + Turborepo）之上，初始化前端应用 `apps/web` 和共享 UI 库 `packages/ui`，完成 Next.js 14、shadcn/ui v3 和 Tailwind CSS 的技术栈闭环。

## 背景

- **已完成:** Issue #1 完成了 monorepo workspace 初始化（`package.json` + `pnpm-workspace.yaml` + `turbo.json` + `.gitignore`）
- **当前状态:** 无 `apps/*` 和 `packages/*` 子包，Turbo 执行时提示 `0 packages`
- **目标状态:** `apps/web` 可独立运行，`packages/ui` 可作为共享组件库被 web 引用

## 技术选型

| 技术栈 | 版本 | 选型理由 |
|--------|------|----------|
| Next.js | 14.x | App Router + TypeScript，社区成熟，与 shadcn/ui v3 兼容最佳 |
| shadcn/ui | v3 | 稳定版本，文档丰富，Tailwind CSS v3 生态成熟 |
| Tailwind CSS | v3 | shadcn/ui v3 的标配，配置方式成熟 |
| pnpm | 10.12.1 | 与现有 monorepo 底座一致 |
| Turborepo | 2.5.2 | 与现有 monorepo 底座一致 |

## 方案：手动分步初始化

### 架构设计

```
kiyo/
├── apps/
│   └── web/                 # Next.js 14 前端应用
│       ├── src/
│       │   ├── app/         # App Router
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   └── globals.css
│       │   └── components/  # 业务组件（引用 @kiyo/ui）
│       ├── public/
│       ├── tailwind.config.ts
│       ├── postcss.config.js
│       ├── next.config.js
│       ├── tsconfig.json
│       └── package.json     # 依赖 @kiyo/ui
│
├── packages/
│   └── ui/                  # shadcn/ui v3 组件库
│       ├── src/
│       │   ├── components/  # shadcn 组件目录（如 ui/button.tsx）
│       │   ├── lib/
│       │   │   └── utils.ts   # cn() 工具函数
│       │   └── globals.css  # Tailwind 指令 + CSS 变量
│       ├── components.json  # shadcn/ui 配置
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── index.ts         # 统一导出组件和 cn()
│
├── package.json (root)
├── pnpm-workspace.yaml
└── turbo.json
```

### 数据流 / 依赖关系

```
apps/web
├── depends on: @kiyo/ui (workspace:*)
├── depends on: next, react, react-dom
├── tailwind.config.ts content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}']
└── postcss.config.js: 使用 tailwindcss, autoprefixer

packages/ui
├── exports: components/*, lib/utils (cn)
├── depends on: tailwindcss, class-variance-authority, clsx, tailwind-merge, lucide-react
├── depends on: @radix-ui/react-* (按需)
└── tailwind.config.ts: 管理 theme.colors, theme.extend, plugins
```

### 模块 1：apps/web 初始化

**文件：**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`

**核心配置：**

`apps/web/package.json`:
```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.35",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@kiyo/ui": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5"
  }
}
```

`apps/web/tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
```

### 模块 2：packages/ui 初始化

**文件：**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/tailwind.config.ts`
- Create: `packages/ui/components.json`
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/globals.css`
- Create: `packages/ui/index.ts`

**核心配置：**

`packages/ui/package.json`:
```json
{
  "name": "@kiyo/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3.4.14",
    "typescript": "^5"
  },
  "peerDependencies": {
    "react": "^18",
    "react-dom": "^18"
  }
}
```

`packages/ui/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

`packages/ui/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

`packages/ui/index.ts`:
```typescript
export { cn } from './src/lib/utils'
```

### 模块 3：链路验证

1. 在 `packages/ui/src/components/ui/button.tsx` 中创建一个示例 Button 组件（基于 shadcn/ui 标准结构）
2. 在 `apps/web/src/app/page.tsx` 中导入并渲染该 Button
3. 运行 `pnpm dev --filter=web`，验证：
   - 开发服务器正常启动（端口 3000）
   - 页面正常渲染
   - Button 组件样式正确（背景色、圆角、hover 状态）

## 影响与风险

| 影响点 | 说明 |
|--------|------|
| 新增依赖 | `apps/web` 和 `packages/ui` 引入 Next.js、React、Tailwind CSS 等依赖，根目录 `pnpm-lock.yaml` 会大幅膨胀 |
| 构建时间 | 首次 `pnpm install` 时间会增加（Next.js + React 体积较大） |
| 版本锁定 | 明确锁定 Next.js 14.x，避免自动升级到 15.x 导致与 shadcn/ui v3 不兼容 |
| 风险 | 低，所有技术栈均为成熟稳定版本 |

## 验收标准

- [ ] `apps/web` 可独立运行（`pnpm dev --filter=web`）
- [ ] `packages/ui` 中添加的 shadcn 组件可在 web 中正常渲染样式
- [ ] 主题配置（colors / radius）在 `packages/ui` 中统一管理
- [ ] `cn()` 工具函数可从 `@kiyo/ui` 正确导入
- [ ] `pnpm build` 和 `pnpm type-check` 在根目录可正常执行（Turbo 编排）
