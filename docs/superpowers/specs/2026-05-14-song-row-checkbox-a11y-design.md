# SongRow 复选框可访问性修复设计

## 背景
GitHub Issue #178：新建专辑弹窗中的 `SongRow` 组件复选框缺少 accessible name，屏幕阅读器用户无法判断每个复选框对应哪首歌。同时验收标准要求点击歌曲标题区域也能切换对应复选框。

## 目标
- 为每个歌曲复选框绑定对应歌曲标题作为 accessible name。
- 点击歌曲标题区域可切换对应复选框。
- 视觉外观保持不变。

## 方案
采用显式 `htmlFor` + `id` 关联（方案 B）。

## 改动范围
仅修改 `packages/ui/src/components/song-row.tsx` 一个文件。

## 具体实现

### 1. 生成唯一 id
使用 `React.useId()` 前缀拼接 `song.id`，生成合法的 DOM id，避免 `song.id`（UUID）中的特殊字符问题：
```tsx
const checkboxId = React.useId() + '-' + id
```

### 2. Checkbox 绑定 id
将生成的 `checkboxId` 传入 `Checkbox` 组件：
```tsx
<Checkbox id={checkboxId} checked={selected} ... />
```

### 3. 标题替换为 label
将原来的 `<span>` 替换为 `<label>`，并通过 `htmlFor` 显式关联 Checkbox：
```tsx
<label
  htmlFor={checkboxId}
  className="flex-1 text-sm font-medium cursor-pointer select-none"
>
  {title}
</label>
```

### 4. 引入 React
确认文件顶部已 `import * as React from "react"`。

## 验收标准
- 屏幕阅读器能读出每个复选框对应的歌曲标题。
- 点击歌曲标题区域可切换对应复选框。
- 键盘导航顺序清晰（已有 focus-visible 样式）。
- 视觉样式与改动前一致。
