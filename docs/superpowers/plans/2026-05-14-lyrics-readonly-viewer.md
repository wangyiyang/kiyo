# 歌词详情页只读展示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `StructuredBlockViewer` 组件，在歌词详情页以文章式排版只读展示歌词，消除可聚焦的 textbox。

**Architecture:** 从 `StructuredBlockEditor` 中分离出纯展示逻辑，新建独立的 `StructuredBlockViewer` 组件。详情页用 Viewer 替换 Editor（readOnly），编辑页保持 Editor 不变。关注点分离，编辑态与阅读态有明确边界。

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui, Vitest, @testing-library/react, jsdom

---

## 文件结构

| 文件 | 操作 | 说明 |
|---|---|---|
| `packages/ui/src/components/structured-block-viewer.tsx` | 创建 | 新建只读歌词展示组件 |
| `packages/ui/src/components/__tests__/structured-block-viewer.test.tsx` | 创建 | 组件单元测试 |
| `packages/ui/vitest.config.ts` | 创建 | UI 包测试配置（参考 apps/web） |
| `packages/ui/src/test-setup.ts` | 创建 | 测试环境 setup（ResizeObserver/Blob polyfill） |
| `packages/ui/package.json` | 修改 | 添加 test script 和测试 devDependencies |
| `packages/ui/index.ts` | 修改 | 导出 `StructuredBlockViewer` |
| `apps/web/src/app/[locale]/lyrics/[id]/page.tsx` | 修改 | 详情页替换 `StructuredBlockEditor readOnly` 为 `StructuredBlockViewer` |

---

### Task 1: 给 `packages/ui` 添加测试基础设施

**Files:**
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/test-setup.ts`
- Modify: `packages/ui/package.json`

`packages/ui` 已有 `vitest` 但未配置 React 组件测试环境。参考 `apps/web` 的 vitest 配置，给 UI 包补充测试能力，使 `blocks.test.ts` 和新组件测试都能运行。

- [ ] **Step 1: 创建 `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, './src/$1') },
    ],
  },
})
```

- [ ] **Step 2: 创建 `packages/ui/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (reader.result) resolve(reader.result as ArrayBuffer)
        else reject(new Error('Failed to read blob as array buffer'))
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(this)
    })
  }
}
```

- [ ] **Step 3: 修改 `packages/ui/package.json` 添加依赖和脚本**

在 `devDependencies` 中新增：
```json
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^25.0.1",
```

在 `scripts` 中新增：
```json
    "test": "vitest run",
```

完整修改后的 `devDependencies` 和 `scripts` 片段：

```json
  "scripts": {
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  },
```

```json
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/howler": "^2.2.11",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@typescript-eslint/eslint-plugin": "^8.59.2",
    "@typescript-eslint/parser": "^8.59.2",
    "@vitejs/plugin-react": "^4.4.1",
    "eslint": "^8.57.1",
    "jsdom": "^25.0.1",
    "next": "^14",
    "tailwindcss": "^3.4.14",
    "typescript": "^5",
    "vitest": "^4.1.5"
  },
```

- [ ] **Step 4: 安装依赖**

Run: `pnpm install`
Expected: 成功安装新增 devDependencies，无报错。

- [ ] **Step 5: 运行已有测试验证基础设施**

Run: `pnpm --filter @kiyo/ui test`
Expected: 运行 `blocks.test.ts` 并通过。

- [ ] **Step 6: Commit**

```bash
git add packages/ui/vitest.config.ts packages/ui/src/test-setup.ts packages/ui/package.json pnpm-lock.yaml
git commit -m "chore(ui): add vitest test infrastructure for @kiyo/ui"
```

---

### Task 2: 实现 `StructuredBlockViewer` 组件

**Files:**
- Create: `packages/ui/src/components/structured-block-viewer.tsx`
- Modify: `packages/ui/index.ts`

- [ ] **Step 1: 创建 `packages/ui/src/components/structured-block-viewer.tsx`**

```tsx
import * as React from 'react'
import { cn } from '../lib/utils'
import type { Block } from '../lib/blocks'

export interface StructuredBlockViewerProps {
  blocks: Block[]
  className?: string
}

export function StructuredBlockViewer({
  blocks,
  className,
}: StructuredBlockViewerProps) {
  return (
    <article className={cn('space-y-6', className)}>
      {blocks.map((block) => (
        <section key={block.id}>
          <h3 className="mb-2 text-sm font-semibold text-primary">
            [{block.tag}]
          </h3>
          {block.content.trim() ? (
            <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {block.content}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </section>
      ))}
    </article>
  )
}
```

- [ ] **Step 2: 在 `packages/ui/index.ts` 中导出组件**

在文件末尾添加：

```ts
export { StructuredBlockViewer } from "./src/components/structured-block-viewer";
export type { StructuredBlockViewerProps } from "./src/components/structured-block-viewer";
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/structured-block-viewer.tsx packages/ui/index.ts
git commit -m "feat(ui): add StructuredBlockViewer read-only component"
```

---

### Task 3: 编写 `StructuredBlockViewer` 单元测试

**Files:**
- Create: `packages/ui/src/components/__tests__/structured-block-viewer.test.tsx`

- [ ] **Step 1: 创建测试文件**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StructuredBlockViewer } from '../structured-block-viewer'

describe('StructuredBlockViewer', () => {
  it('renders blocks with tags and content', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Line 1\nLine 2' },
      { id: '2', tag: 'Chorus', content: 'Chorus line' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.getByText('[Verse]')).toBeInTheDocument()
    expect(screen.getByText('Line 1\nLine 2')).toBeInTheDocument()
    expect(screen.getByText('[Chorus]')).toBeInTheDocument()
    expect(screen.getByText('Chorus line')).toBeInTheDocument()
  })

  it('renders placeholder for empty content', () => {
    const blocks = [{ id: '1', tag: 'Intro', content: '' }]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.getByText('[Intro]')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not render input or textarea elements', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Some lyrics' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const blocks = [{ id: '1', tag: 'Text', content: 'Hello' }]

    const { container } = render(
      <StructuredBlockViewer blocks={blocks} className="my-custom-class" />
    )

    expect(container.querySelector('article')).toHaveClass('my-custom-class')
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `pnpm --filter @kiyo/ui test`
Expected: 4 个测试全部通过（包括已有的 blocks.test.ts 和新测试）。

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/__tests__/structured-block-viewer.test.tsx
git commit -m "test(ui): add StructuredBlockViewer unit tests"
```

---

### Task 4: 歌词详情页替换为 `StructuredBlockViewer`

**Files:**
- Modify: `apps/web/src/app/[locale]/lyrics/[id]/page.tsx`

- [ ] **Step 1: 修改导入和组件使用**

将 `apps/web/src/app/[locale]/lyrics/[id]/page.tsx` 中的：

```tsx
import { StructuredBlockEditor, textToBlocks, Button, SongStatusBadge } from '@kiyo/ui'
```

替换为：

```tsx
import { StructuredBlockViewer, textToBlocks, Button, SongStatusBadge } from '@kiyo/ui'
```

将：

```tsx
      <StructuredBlockEditor blocks={blocks} readOnly />
```

替换为：

```tsx
      <StructuredBlockViewer blocks={blocks} />
```

- [ ] **Step 2: 运行类型检查**

Run: `pnpm --filter web type-check`
Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/lyrics/[id]/page.tsx
git commit -m "fix(lyrics): use StructuredBlockViewer on detail page (issue #157)"
```

---

### Task 5: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `pnpm --filter web dev`

- [ ] **Step 2: 手动验证**

1. 登录并访问任意歌词详情页（如 `/lyrics/{id}`）。
2. 确认歌词以文章式排版展示，无卡片边框。
3. 按 Tab 键导航，确认不会进入歌词段落（无 textbox）。
4. 打开浏览器开发者工具 → Accessibility 面板，确认可访问性树中歌词区域为文本内容，无 `textbox` 角色。
5. 点击「编辑」按钮，进入 `/edit` 页面，确认编辑功能正常（卡片式布局、可编辑 textarea、上移/下移/删除按钮均在）。

- [ ] **Step 3: 运行 web 测试**

Run: `pnpm --filter web test`
Expected: 现有测试全部通过。

- [ ] **Step 4: 运行 lint**

Run: `pnpm --filter web lint && pnpm --filter @kiyo/ui lint`
Expected: 无 lint 错误。

- [ ] **Step 5: Final commit（如有改动）**

如果有 lint 或格式修复：

```bash
git add -A
git commit -m "style: fix lint after lyrics detail page refactor"
```

---

## 自审检查

### 1. Spec 覆盖

| Spec 要求 | 对应任务 |
|---|---|
| 新建 `StructuredBlockViewer` 组件 | Task 2 |
| 文章式排版（space-y-6、标签、内容样式） | Task 2 |
| 空内容占位符 `—` | Task 2 |
| 详情页替换 `StructuredBlockEditor readOnly` | Task 4 |
| 无障碍：无 input/textarea/button | Task 2、Task 3 |
| Tab 不进入段落 | Task 2（无交互控件自然达成） |
| 编辑页不受影响 | 未修改 edit page，验证 Task 5 |
| 单元测试 | Task 3 |

### 2. Placeholder 扫描

- 无 "TBD"、"TODO"、"implement later"。
- 无模糊描述，所有步骤含完整代码或命令。
- 无 "Similar to Task N" 引用。

### 3. 类型一致性

- `Block` 类型来自 `@kiyo/ui` 共享定义，与 `StructuredBlockEditor` 一致。
- `StructuredBlockViewerProps` 接口使用 `Block[]` 和可选 `className`，与 spec 一致。
