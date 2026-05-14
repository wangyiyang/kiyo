# 歌词详情页只读展示设计（Issue #157）

## 背景与问题

歌词详情页处于阅读/详情场景，但歌词正文被渲染为多个可编辑 `<textarea>`（通过 `StructuredBlockEditor readOnly`）。这导致：

- 每个歌词段落都是可聚焦的 `textbox`，Tab 导航逐个进入。
- 浏览器可访问性树暴露多个输入控件，与「编辑」按钮产生 UX 冲突。
- 阅读态和编辑态边界不清晰。

## 目标

- 歌词详情页以纯只读排版展示歌词正文，不使用任何表单控件。
- Tab 导航不会进入歌词段落。
- 编辑能力保留在明确的 `/edit` 页面中。

## 方案：新建 `StructuredBlockViewer` 组件

采用「文章式」排版，与编辑态的「卡片式」形成明确区分。

### 组件架构

```
packages/ui/src/components/
  structured-block-editor.tsx   # 现有，编辑态，不变
  structured-block-viewer.tsx   # 新建，只读态
packages/ui/src/components/__tests__/
  structured-block-viewer.test.tsx  # 新建
```

**`StructuredBlockViewer` 接口：**

```tsx
export interface StructuredBlockViewerProps {
  blocks: Block[]
  className?: string
}
```

- 纯展示组件，无 `onChange`，无内部 state。
- 接收 `blocks` 和可选 `className`。

### 视觉与排版细节

- **容器**：`<article>` 包裹所有段落，应用 `space-y-6` 纵向间距，无边框、无卡片背景。
- **标签（Tag）**：每个 block 前独占一行展示 `[Tag]`，样式 `text-sm font-semibold text-primary`。
- **内容（Content）**：`<p className="whitespace-pre-wrap leading-relaxed">` 渲染，保留换行格式；`text-base text-foreground`。
- **空内容处理**：如果 `content` 为空字符串，渲染轻灰色占位符 `—`，避免标签下方直接空白。

**编辑态 vs 阅读态对比：**

| 维度 | 编辑态（StructuredBlockEditor） | 阅读态（StructuredBlockViewer） |
|---|---|---|
| 布局 | 卡片式，每个 block 一个边框卡片 | 文章式，无卡片，纵向自然流 |
| 标签 | 可编辑的 `<Input>` | 纯文本 `[Tag]` |
| 内容 | `<Textarea>`，可输入 | `<p>`，不可聚焦 |
| 操作按钮 | 上移/下移/删除/添加区块 | 无 |

### 页面变更

`apps/web/src/app/[locale]/lyrics/[id]/page.tsx`：

将：
```tsx
<StructuredBlockEditor blocks={blocks} readOnly />
```
替换为：
```tsx
<StructuredBlockViewer blocks={blocks} />
```

编辑页 `apps/web/src/app/[locale]/lyrics/[id]/edit/page.tsx` 不受影响，继续使用 `StructuredBlockEditor`。

### 数据流与错误处理

- 详情页仍是 Server Component，从 Supabase 读取歌词，通过 `textToBlocks(lyric.content)` 转换后传给 Viewer。
- `StructuredBlockViewer` 无 state、无 side effect。
- 空歌词正常渲染，空 content 显示占位符。
- `Block[]` 类型来自 `@kiyo/ui` 共享定义，无需新增类型。

### 测试策略

- **单元测试（新增）**：`packages/ui/src/components/__tests__/structured-block-viewer.test.tsx`
  - 正常渲染：传入多个 blocks，验证标签和内容正确显示。
  - 空 content：传入空字符串 content，验证占位符 `—` 被渲染。
  - 无障碍：验证输出中无 `<input>`、`<textarea>` 元素。
- **集成测试**：现有 API 测试不受影响。
- **手动验证**：
  1. 访问歌词详情页，确认文章式排版，无 textbox。
  2. Tab 导航不进入歌词段落。
  3. 点击「编辑」进入 `/edit`，确认编辑功能正常。

### 无障碍

- 输出中不含 `<input>`、`<textarea>`、`<button>` 等交互控件。
- 使用语义化 HTML（`<article>`、`<p>`），屏幕阅读器正确识别为文本内容。
- Tab 导航不会停留在歌词段落上。

## 验收标准

- [ ] 歌词详情页正文不再以 enabled textbox 暴露给用户。
- [ ] Tab 导航不会逐个进入歌词段落输入框。
- [ ] 编辑能力保留在明确的 `/edit` 页面中。
- [ ] 新增 `StructuredBlockViewer` 组件并通过单元测试。
