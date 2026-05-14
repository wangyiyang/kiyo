# SongRow 复选框可访问性修复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `SongRow` 组件中的歌曲复选框绑定可访问名称，并支持点击标题区域切换复选框。

**Architecture:** 使用显式 `htmlFor` + `id` 关联 Checkbox 与 label，通过 `React.useId()` 生成唯一 DOM id。

**Tech Stack:** React, TypeScript, Radix UI Checkbox, Tailwind CSS

---

## 文件结构

| 文件 | 动作 | 说明 |
|------|------|------|
| `packages/ui/src/components/song-row.tsx` | 修改 | 引入 `React.useId()`，为 Checkbox 绑定 `id`，标题区域替换为 `<label>` |

---

### Task 1: 修改 SongRow 组件实现可访问性关联

**Files:**
- Modify: `packages/ui/src/components/song-row.tsx`

**改动说明：**
- 文件顶部引入 `import * as React from 'react'`（如果尚未引入）。
- 在 `SongRow` 函数体内使用 `React.useId()` 生成唯一 `checkboxId`。
- 将 `Checkbox` 的 `id` 属性绑定到 `checkboxId`。
- 将展示标题的 `<span>` 替换为 `<label>`，并通过 `htmlFor` 显式关联到 Checkbox（仅在 `mode === 'select'` 时传入 `htmlFor`）。
- 给 label 添加 `cursor-pointer select-none` 样式。

- [ ] **Step 1: 应用代码修改**

修改 `packages/ui/src/components/song-row.tsx`：

```tsx
import * as React from 'react'
import { Checkbox } from './ui/checkbox'

interface SongRowProps {
  id: string
  title: string
  mode: 'select' | 'drag'
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  dragHandle?: React.ReactNode
}

export function SongRow({ id, title, mode, selected, onSelect, dragHandle }: SongRowProps) {
  const checkboxId = React.useId() + '-' + id

  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50">
      {mode === 'select' && onSelect && (
        <Checkbox
          id={checkboxId}
          checked={selected}
          onCheckedChange={(checked) => onSelect(id, checked === true)}
        />
      )}
      {mode === 'drag' && dragHandle}
      <label
        htmlFor={mode === 'select' ? checkboxId : undefined}
        className="flex-1 text-sm font-medium cursor-pointer select-none"
      >
        {title}
      </label>
    </div>
  )
}
```

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run: `pnpm type-check`
Expected: 无类型错误，正常退出。

- [ ] **Step 3: 运行 lint 检查**

Run: `pnpm lint`
Expected: 无 lint 错误。

- [ ] **Step 4: 手动验证可访问性**

1. 启动开发服务器：`pnpm --filter web dev`
2. 打开 `http://localhost:3000/albums`
3. 点击"新建专辑"
4. 打开浏览器 DevTools → Elements → Accessibility 面板（或 Lighthouse a11y audit）
5. 选中任意歌曲复选框，确认其 accessible name 显示为对应歌曲标题
6. 点击歌曲标题文字，确认复选框状态切换

- [ ] **Step 5: 提交代码**

```bash
git add packages/ui/src/components/song-row.tsx
git commit -m "fix(a11y): 为 SongRow 复选框绑定可访问名称并支持点击标题切换 (#178)"
```

---

## Self-Review

**1. Spec 覆盖：**
- ✅ 屏幕阅读器能读出每个复选框对应歌曲标题（通过 `htmlFor` + `id` 关联）
- ✅ 点击标题区域也能切换对应复选框（label 的默认行为）
- ✅ 键盘导航顺序清晰（未改动，已有 focus-visible 样式）

**2. Placeholder 扫描：**
- 无 TBD、TODO 或模糊描述。

**3. 类型一致性：**
- `SongRowProps` 接口未改动，签名保持一致。
- `Checkbox` 来自 Radix UI，其 Root 组件原生支持 `id` 属性。
