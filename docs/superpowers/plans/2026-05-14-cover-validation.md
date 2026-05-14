# Cover Validation Button Disable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在未选择音频源时禁用 AI 翻唱页面的「开始翻唱」按钮。

**Architecture:** 在现有 CoverSongPage 组件中新增 `canSubmit` 派生状态，综合 audio source 有效性、风格选择及上传状态，控制提交按钮的 `disabled` 属性。

**Tech Stack:** React, TypeScript, Next.js 14, Tailwind CSS

---

### Task 1: Add `canSubmit` derived state and update button disabled

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/cover/page.tsx`

- [ ] **Step 1: Add `hasAudioSource` and `canSubmit` derived states**

在 `CoverSongPage` 组件内、现有 `styleOptions` 之后、`React.useEffect` 之前插入：

```tsx
  const hasAudioSource =
    sourceMode === 'existing'
      ? songs.some((s) => s.id === selectedSongId && (s.file_path || s.audio_url))
      : !!uploadedUrl

  const canSubmit = hasAudioSource && !!selectedStyle && !uploading
```

- [ ] **Step 2: Update the submit button disabled prop**

找到提交按钮：

```tsx
<Button onClick={handleGenerate} disabled={generating || uploading}>
```

替换为：

```tsx
<Button onClick={handleGenerate} disabled={generating || !canSubmit}>
```

- [ ] **Step 3: Verify with type-check**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/songs/cover/page.tsx
git commit -m "fix(cover): disable submit button when no audio source selected (#161)"
```

---

### Self-Review

**1. Spec coverage:**
- ✅ 未选择已有歌曲 → disabled（`sourceMode === 'existing'` 且无匹配 song）
- ✅ 切换到上传 tab 但未上传 → disabled（`sourceMode === 'upload'` 且 `!uploadedUrl`）
- ✅ 未选风格 → disabled（`!selectedStyle`）
- ✅ 上传中 → disabled（`uploading`）
- ✅ `handleGenerate` 原有校验保留作为兜底

**2. Placeholder scan:** 无 TBD/TODO/模糊描述。

**3. Type consistency:** `canSubmit` 为 `boolean`，与 `disabled` prop 类型一致。
