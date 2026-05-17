# ShowcaseCard 展示卡片信息优化

## Issue
#233 — feat(ui): 探索页歌曲卡片信息优化

## 目标
优化探索页歌曲卡片的显示效果，确保卡片高度统一、标题截断优雅、hover 显示完整标题。

## 设计方案

### 卡片结构
```
┌─────────────────────────┐
│                         │
│      Cover Image        │  ← aspect-square (1:1)
│      或 Gradient         │
│                         │
├─────────────────────────┤
│  GENRE                  │  ← 固定底部区域 h-20 (80px)
│  Title (单行截断)        │  ← line-clamp-1 + Tooltip
│  Mood · Duration        │
└─────────────────────────┘
```

### 具体实现细节

| 元素 | 实现 |
|------|------|
| 卡片容器 | `aspect-square` + 底部固定 `h-20` |
| 标题截断 | `line-clamp-1`（单行，超长时显示省略号） |
| Tooltip | 居中弹出，hover 显示完整标题，内容为 `track.title` |
| 信息层级 | Genre（uppercase 小字）→ Title → Mood + Duration |
| 交互 | hover 时封面图 scale 动效保留，Tooltip 叠加 |

### 涉及文件
- `apps/web/src/components/sections/showcase-card.tsx`

### 验收清单
- [x] 歌曲卡片高度统一（aspect-square + h-20）
- [x] 标题过长时截断显示（line-clamp-1）
- [x] hover 显示完整标题（居中 Tooltip）

## 实现步骤

1. 导入 Tooltip 组件（来自 `@kiyo/ui` 或 `ui` 包）
2. 将标题包裹在 Tooltip 内，设置 Tooltip 内容为完整标题 `track.title`
3. 标题样式添加 `line-clamp-1`
4. 底部区域确认固定高度 `h-20`
5. 测试不同长度标题的截断和 tooltip 显示效果