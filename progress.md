# Progress - Issue #224, #223, #229, #230, #231

## ✅ 全部完成

| Issue | 标题 | 状态 | PR/分支 | Closes |
|-------|------|------|---------|--------|
| #231 | 歌词详情页段落展示优化 | ✅ 已合并 | [PR #238](https://github.com/wangyiyang/kiyo/pull/238) | #231 |
| #230 | 设置页删除账户增加二次确认 | ✅ 已实现 | `feat/231-lyrics-paragraph-display` | #230 |
| #223 | 新建专辑页面引导 | ✅ 已实现 | `feat/231-lyrics-paragraph-display` | #223 |
| #224 | 歌词生成页引导文案 | ✅ 已实现 | `feat/231-lyrics-paragraph-display` | #224 |
| #229 | 分享功能 Toast 反馈 | ✅ 已实现 | 原代码已有 toast 反馈 | #229 |

---

## 改动摘要

### #231 - 歌词详情页段落展示优化
**文件**: `packages/ui/src/components/structured-block-viewer.tsx`
- 使用 Radix UI Accordion 实现可折叠段落
- 段落类型颜色标签（主歌蓝色、副歌紫色等）

### #230 - 设置页删除账户二次确认
**文件**: `apps/web/src/components/settings/delete-account-dialog.tsx`
- 增加 AlertTriangle 警告图标
- 危险步骤红色边框和标题

### #223 - 新建专辑页面引导
**文件**: `apps/web/src/app/[locale]/(dashboard)/albums/_components/AlbumFormDialog.tsx`
- 新增 `songSelector.hint` 和 `songSelector.empty` 引导文案

### #224 - 歌词生成页引导文案
**文件**: `apps/web/src/app/[locale]/(dashboard)/lyrics/generate/page.tsx`
- 增加引导卡片（Lightbulb 图标 + 标题描述）

### #229 - 分享功能 Toast
**文件**: `apps/web/src/components/share-button.tsx`
- 原代码已有 `toast.success(t('copied'))` 反馈

---

## 分支状态

当前分支: `feat/231-lyrics-paragraph-display`
```
5d75bbd feat(ui): 优化新建专辑页面引导 (Closes #223)
dc8761e feat(ui): 设置页删除账户增加红色警示标识 (#230)
...
```

---

## 需补充

PR #238 目前只绑定 #231，需要补充绑定 #223、#224、#230：
```bash
gh pr edit 238 --body "Closes #231\nCloses #223\nCloses #224\nCloses #230"
```

或者分拆为多个 PR。