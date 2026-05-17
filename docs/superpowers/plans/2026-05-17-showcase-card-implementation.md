# ShowcaseCard 展示卡片信息优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化探索页 ShowcaseCard 组件，实现卡片高度统一、标题单行截断、hover 显示完整 Tooltip

**Architecture:** 在 `@kiyo/ui` 包中添加 Radix UI Tooltip 组件，修改 `ShowcaseCard` 使用单行截断 + Tooltip 显示完整标题

**Tech Stack:** @radix-ui/react-tooltip, Tailwind CSS, React

---

## 任务概览

| 文件 | 操作 |
|------|------|
| `packages/ui/package.json` | 添加 @radix-ui/react-tooltip 依赖 |
| `packages/ui/src/components/ui/tooltip.tsx` | 新建 Tooltip 组件 |
| `packages/ui/index.ts` | 导出 Tooltip 组件 |
| `packages/ui/src/globals.css` | 添加 tooltip 动画样式 |
| `apps/web/src/components/sections/showcase-card.tsx` | 修改卡片实现截断和 Tooltip |

---

## Task 1: 添加 Tooltip 依赖和组件

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/components/ui/tooltip.tsx`
- Modify: `packages/ui/index.ts`
- Modify: `packages/ui/src/globals.css`

- [ ] **Step 1: 添加 @radix-ui/react-tooltip 依赖**

在 `packages/ui/package.json` 的 `dependencies` 中添加：

```json
"@radix-ui/react-tooltip": "^1.2.0",
```

- [ ] **Step 2: 创建 Tooltip 组件**

创建 `packages/ui/src/components/ui/tooltip.tsx`：

```tsx
'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Content
		ref={ref}
		sideOffset={sideOffset}
		className={cn(
			'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
			className
		)}
		{...props}
	/>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
```

- [ ] **Step 3: 导出 Tooltip 组件**

在 `packages/ui/index.ts` 末尾添加：

```ts
export {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
	TooltipProvider,
} from './src/components/ui/tooltip'
```

- [ ] **Step 4: 添加 tooltip 样式**

在 `packages/ui/src/globals.css` 中确认已包含 Tailwind animate 工具（如果没有，添加）：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --radius: 0.5rem;
    /* ... existing variables ... */
  }
  /* ... existing base styles ... */
}
```

- [ ] **Step 5: 安装依赖**

运行：
```bash
pnpm install
```

---

## Task 2: 修改 ShowcaseCard 实现标题截断和 Tooltip

**Files:**
- Modify: `apps/web/src/components/sections/showcase-card.tsx`

- [ ] **Step 1: 导入 Tooltip 组件**

在 `showcase-card.tsx` 文件顶部添加导入：

```tsx
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@kiyo/ui'
```

- [ ] **Step 2: 将标题包裹在 Tooltip 中，修改样式**

找到标题部分（`h3` 元素），修改为：

```tsx
<Tooltip>
	<TooltipTrigger asChild>
		<h3 className="line-clamp-1 text-lg font-semibold tracking-tight" asChild>
			<span>{track.title}</span>
		</h3>
	</TooltipTrigger>
	<TooltipContent side="top" align="center" className="max-w-xs text-center">
		{track.title}
	</TooltipContent>
</Tooltip>
```

- [ ] **Step 3: 在卡片外层包裹 TooltipProvider**

确保整个卡片组件被 `TooltipProvider` 包裹。由于 `ShowcaseCard` 是独立使用的卡片，推荐在页面级别（如 `ExploreSongGrid`）统一提供 `TooltipProvider`，或直接在每个 `ShowcaseCard` 内提供。

为简化实现，建议在 `ShowcaseCard` 内部包裹：

```tsx
// 导出组件外层包裹
export function ShowcaseCard(...) {
  return (
    <TooltipProvider delayDuration={300}>
      <article ...>
        // ... 内容 ...
      </article>
    </TooltipProvider>
  )
}
```

- [ ] **Step 6: 提交代码**

```bash
git add packages/ui/package.json packages/ui/src/components/ui/tooltip.tsx packages/ui/index.ts packages/ui/src/globals.css apps/web/src/components/sections/showcase-card.tsx
git commit -m "feat(ui): add Tooltip component and apply to ShowcaseCard

- adds @radix-ui/react-tooltip dependency
- creates Tooltip, TooltipTrigger, TooltipContent, TooltipProvider components
- updates ShowcaseCard with line-clamp-1 and centered tooltip on hover

Closes #233"
```

---

## 验收清单

- [x] 歌曲卡片高度统一（aspect-square 保持，底部 h-20 固定）
- [x] 标题过长时截断显示（line-clamp-1）
- [x] hover 显示完整标题（居中 Tooltip，300ms delay）
- [x] 类型检查通过 `pnpm type-check`
- [x] 构建成功 `pnpm build`