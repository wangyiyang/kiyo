# Next.js + shadcn/ui + Tailwind CSS 初始化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 monorepo 中初始化 `apps/web`（Next.js 14）和 `packages/ui`（shadcn/ui v3），完成开发环境搭建和组件链路验证。

**Architecture:** `packages/ui` 作为共享 UI 库封装 shadcn/ui v3 组件和 `cn()` 工具函数，`apps/web` 通过 workspace 依赖引用 `@kiyo/ui`。Tailwind CSS 的 `content` 配置跨包扫描，确保 `packages/ui` 中的组件样式能被正确编译。

**Tech Stack:** Next.js 14.2.x, React 18.3.x, TypeScript 5.x, Tailwind CSS 3.4.x, shadcn/ui v3, pnpm 10.x, Turborepo 2.5.x

---

### 文件结构映射

**新增文件：**
- `packages/ui/package.json` — `@kiyo/ui` 包配置和依赖
- `packages/ui/tsconfig.json` — TypeScript 编译配置
- `packages/ui/tailwind.config.ts` — Tailwind 主题配置（colors / radius）
- `packages/ui/components.json` — shadcn/ui CLI 配置
- `packages/ui/src/globals.css` — Tailwind 指令和 CSS 变量
- `packages/ui/src/lib/utils.ts` — `cn()` 工具函数（clsx + tailwind-merge）
- `packages/ui/src/components/ui/button.tsx` — 示例 Button 组件
- `packages/ui/index.ts` — 统一导出
- `apps/web/package.json` — web 应用配置和依赖
- `apps/web/tsconfig.json` — TypeScript 编译配置
- `apps/web/next.config.js` — Next.js 配置
- `apps/web/tailwind.config.ts` — Tailwind content 配置（包含 packages/ui 路径）
- `apps/web/postcss.config.js` — PostCSS 配置
- `apps/web/src/app/globals.css` — 全局样式，导入 @kiyo/ui 的 globals.css
- `apps/web/src/app/layout.tsx` — 根布局
- `apps/web/src/app/page.tsx` — 首页（引用 Button 验证链路）

**修改文件：**
- `pnpm-lock.yaml` — 安装依赖后自动生成

---

### Task 1: 创建 `packages/ui` 基础结构

**Files:**
- Create: `/home/kk/Github/kiyo/packages/ui/package.json`
- Create: `/home/kk/Github/kiyo/packages/ui/tsconfig.json`

- [ ] **Step 1: 创建 `packages/ui/package.json`**

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

- [ ] **Step 2: 创建 `packages/ui/tsconfig.json`**

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

- [ ] **Step 3: 验证文件创建**

Run:
```bash
ls -la /home/kk/Github/kiyo/packages/ui/
```
Expected:
```
package.json
tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/package.json packages/ui/tsconfig.json
git commit -m "chore: initialize packages/ui base structure

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: 创建 `packages/ui` 工具函数和配置

**Files:**
- Create: `/home/kk/Github/kiyo/packages/ui/src/lib/utils.ts`
- Create: `/home/kk/Github/kiyo/packages/ui/src/globals.css`
- Create: `/home/kk/Github/kiyo/packages/ui/tailwind.config.ts`
- Create: `/home/kk/Github/kiyo/packages/ui/components.json`
- Create: `/home/kk/Github/kiyo/packages/ui/index.ts`

- [ ] **Step 1: 创建 `src/lib/utils.ts`（cn 工具函数）**

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: 创建 `src/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 3: 创建 `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

- [ ] **Step 4: 创建 `components.json`**

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

- [ ] **Step 5: 创建 `index.ts`**

```typescript
export { cn } from './src/lib/utils'
```

- [ ] **Step 6: 验证文件创建**

Run:
```bash
find /home/kk/Github/kiyo/packages/ui -type f | sort
```
Expected 包含:
```
packages/ui/components.json
packages/ui/index.ts
packages/ui/package.json
packages/ui/src/globals.css
packages/ui/src/lib/utils.ts
packages/ui/tailwind.config.ts
packages/ui/tsconfig.json
```

- [ ] **Step 7: Commit**

```bash
git add packages/ui/
git commit -m "chore: add packages/ui tailwind config, globals.css, utils, and components.json

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: 创建 `apps/web` 基础结构

**Files:**
- Create: `/home/kk/Github/kiyo/apps/web/package.json`
- Create: `/home/kk/Github/kiyo/apps/web/tsconfig.json`
- Create: `/home/kk/Github/kiyo/apps/web/next.config.js`

- [ ] **Step 1: 创建 `apps/web/package.json`**

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

- [ ] **Step 2: 创建 `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 `apps/web/next.config.js`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
```

- [ ] **Step 4: 验证文件创建**

Run:
```bash
ls -la /home/kk/Github/kiyo/apps/web/
```
Expected:
```
next.config.js
package.json
tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js
git commit -m "chore: initialize apps/web base structure

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: 配置 `apps/web` 的 Tailwind 和样式

**Files:**
- Create: `/home/kk/Github/kiyo/apps/web/tailwind.config.ts`
- Create: `/home/kk/Github/kiyo/apps/web/postcss.config.js`
- Create: `/home/kk/Github/kiyo/apps/web/src/app/globals.css`

- [ ] **Step 1: 创建 `apps/web/tailwind.config.ts`**

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

- [ ] **Step 2: 创建 `apps/web/postcss.config.js`**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 3: 创建 `apps/web/src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: 验证文件创建**

Run:
```bash
find /home/kk/Github/kiyo/apps/web -type f | sort
```
Expected 包含:
```
apps/web/next.config.js
apps/web/package.json
apps/web/postcss.config.js
apps/web/src/app/globals.css
apps/web/tailwind.config.ts
apps/web/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/src/app/globals.css
git commit -m "chore: add apps/web tailwind and postcss config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: 创建 `apps/web` 的页面结构

**Files:**
- Create: `/home/kk/Github/kiyo/apps/web/src/app/layout.tsx`
- Create: `/home/kk/Github/kiyo/apps/web/src/app/page.tsx`

- [ ] **Step 1: 创建 `apps/web/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kiyo',
  description: 'AI音乐创作平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 创建 `apps/web/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">Kiyo</h1>
        <p className="mt-4 text-lg">AI音乐创作平台</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/page.tsx
git commit -m "feat: add apps/web layout and home page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: 安装依赖并验证 workspace 引用

**Files:**
- Modify: `/home/kk/Github/kiyo/pnpm-lock.yaml`（自动生成）

- [ ] **Step 1: 安装所有 workspace 依赖**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm install
```
Expected: 成功安装 `next`, `react`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` 等依赖，生成/更新 `pnpm-lock.yaml`，无报错。

- [ ] **Step 2: 验证 workspace 依赖链接**

Run:
```bash
ls -la /home/kk/Github/kiyo/apps/web/node_modules/@kiyo/ui
```
Expected: 显示符号链接指向 `/home/kk/Github/kiyo/packages/ui`

- [ ] **Step 3: 验证 `packages/ui` 依赖安装**

Run:
```bash
ls /home/kk/Github/kiyo/packages/ui/node_modules | head -10
```
Expected: 包含 `clsx`, `tailwind-merge` 等依赖目录

- [ ] **Step 4: Commit lock 文件**

```bash
git add pnpm-lock.yaml
git commit -m "chore: install dependencies for apps/web and packages/ui

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: 创建示例 Button 组件并验证渲染

**Files:**
- Create: `/home/kk/Github/kiyo/packages/ui/src/components/ui/button.tsx`
- Modify: `/home/kk/Github/kiyo/packages/ui/index.ts`
- Modify: `/home/kk/Github/kiyo/apps/web/src/app/page.tsx`

- [ ] **Step 1: 创建 `packages/ui/src/components/ui/button.tsx`**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

- [ ] **Step 2: 修改 `packages/ui/index.ts` 导出 Button**

```typescript
export { cn } from './src/lib/utils'
export { Button } from './src/components/ui/button'
```

- [ ] **Step 3: 修改 `apps/web/src/app/page.tsx` 引用 Button**

```tsx
import { Button } from '@kiyo/ui'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">Kiyo</h1>
        <p className="mt-4 text-lg">AI音乐创作平台</p>
        <div className="mt-8 flex gap-4">
          <Button>默认按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">边框按钮</Button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/ui/button.tsx packages/ui/index.ts apps/web/src/app/page.tsx
git commit -m "feat: add Button component and verify @kiyo/ui workspace link

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: 运行验证

- [ ] **Step 1: 验证开发服务器可启动**

Run:
```bash
cd /home/kk/Github/kiyo && timeout 15 pnpm dev --filter=web || true
```
Expected: Next.js 开发服务器启动，显示 `Ready on http://localhost:3000` 或类似信息。按 Ctrl+C 或 timeout 结束后退出。

- [ ] **Step 2: 验证构建可运行**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm build --filter=web
```
Expected: `web:build` 成功完成，生成 `.next` 目录，无报错。

- [ ] **Step 3: 验证类型检查可运行**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm type-check --filter=web
```
Expected: `web:type-check` 成功完成，无类型错误。

- [ ] **Step 4: 验证根目录命令可运行**

Run:
```bash
cd /home/kk/Github/kiyo && pnpm build
```
Expected: Turbo 编排执行 `web:build` 和 `ui:type-check`，成功完成。

Run:
```bash
cd /home/kk/Github/kiyo && pnpm type-check
```
Expected: Turbo 编排执行所有 workspace 的 `type-check`，成功完成。

- [ ] **Step 5: 最终验收清单**

| 验收项 | 验证命令 | 预期结果 |
|--------|----------|----------|
| `apps/web` 可独立运行 | `pnpm dev --filter=web` | Next.js 启动，监听 3000 端口 |
| `packages/ui` 组件可在 web 渲染 | 访问 `http://localhost:3000` | 页面显示 3 个样式正确的 Button |
| 主题配置在 `packages/ui` 统一管理 | 检查 `packages/ui/tailwind.config.ts` | 包含 colors、radius 等主题配置 |
| `cn()` 可从 `@kiyo/ui` 导入 | 检查 `packages/ui/index.ts` | 导出 `cn` |
| `pnpm build` 可运行 | `pnpm build` | Turbo 成功完成 |
| `pnpm type-check` 可运行 | `pnpm type-check` | Turbo 成功完成 |

---

## Self-Review

**1. Spec coverage:**

| Spec 要求 | 对应 Task |
|-----------|-----------|
| `apps/web` 初始化 Next.js + App Router + TypeScript | Task 3, Task 5 |
| 配置 Tailwind CSS，`content` 包含 `packages/ui` 路径 | Task 4 (Step 1) |
| 初始化 `packages/ui` 作为 shadcn/ui 组件库 | Task 1, Task 2 |
| 导出 `cn()` 工具函数 | Task 2 (Step 1), Task 2 (Step 5) |
| 配置 `@kiyo/ui` 可被 `apps/web` 引用 | Task 3 (Step 1), Task 6 (Step 2) |
| `pnpm dev --filter=web` 可运行 | Task 8 (Step 1) |
| 组件可在 web 中正常渲染样式 | Task 7, Task 8 (Step 2) |
| 主题配置在 `packages/ui` 中统一管理 | Task 2 (Step 3) |

✅ 所有 spec 要求都有对应 task。

**2. Placeholder scan:**

- 无 "TBD", "TODO", "implement later" ✅
- 无 "Add appropriate error handling" 等模糊描述 ✅
- 每个代码步骤都包含完整代码 ✅
- 无 "Similar to Task N" ✅

**3. Type consistency:**

- `cn()` 函数在 Task 2 Step 1 中定义，在 Task 2 Step 5 中导出，签名一致 ✅
- `Button` 组件在 Task 7 Step 1 中定义，在 Task 7 Step 2 中导出，名称一致 ✅
- `tailwind.config.ts` 在两个包中都使用 `Config` 类型，一致 ✅

---

## 执行选项

Plan complete and saved to `docs/superpowers/plans/2026-05-07-nextjs-shadcn-setup.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
