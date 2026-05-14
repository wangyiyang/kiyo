# Issue 201 移动端歌曲卡片标签竖排修复设计

## 问题背景

在移动端视口（390×844）访问 `/songs` 页面时，歌曲卡片右侧的状态标签（如 `"手动创建"`、`"可播放"`）被异常压缩为竖排文字，每个字单独一行，严重影响可读性和美观。

## 根因分析

问题出在 `SongCard` 组件中的标题-标签 flex 布局：

- 标签所在的 `<SongStatusBadge>` 没有 `whitespace-nowrap`，中文字符在空间不足时默认可逐字换行
- 标签没有 `shrink-0`，在 flex 容器中被压缩到极小宽度
- 标题 `<h3>` 没有 `min-w-0` 和截断处理，无法为标签让出合理空间

## 设计方案

采用**方案 A：标签防换行 + 标题截断**，改动最小且保持桌面/移动端一致性。

### 修改范围

| 文件 | 修改内容 |
|------|----------|
| `packages/ui/src/components/song-status-badge.tsx` | Badge 添加 `whitespace-nowrap shrink-0`，防止文字换行和被压缩 |
| `packages/ui/src/components/song-card.tsx` | 标题 `<h3>` 添加 `min-w-0 truncate`，过长时截断，确保标签空间 |

### 详细改动

#### 1. SongStatusBadge (`packages/ui/src/components/song-status-badge.tsx`)

```tsx
// 修改前
<span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', statusClassName[status])}>

// 修改后
<span className={cn('rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap shrink-0', statusClassName[status])}>
```

- `whitespace-nowrap`: 强制标签文字不换行，防止中文字符逐字竖排
- `shrink-0`: 标签在 flex 布局中不参与收缩，保持固有宽度

#### 2. SongCard 标题区域 (`packages/ui/src/components/song-card.tsx`)

```tsx
// 修改前
<h3 className="font-semibold">{title}</h3>

// 修改后
<h3 className="font-semibold min-w-0 truncate">{title}</h3>
```

- `min-w-0`: 覆盖 flex item 默认的 `min-width: auto`，允许标题收缩到比内容更小
- `truncate`: 标题过长时显示省略号，避免挤占标签空间

### 布局效果

**桌面端（无变化）**：标题和标签正常水平排列，标签完整显示。  
**移动端（修复后）**：
- 标题过长时截断显示省略号
- 标签保持水平完整显示，不再被压缩为竖排
- 在 375px ~ 414px 常见移动端宽度下表现良好

## 验收标准

- [x] 移动端歌曲卡片标签正常水平显示
- [x] 标签文字清晰可读，不被截断或压缩为竖排
- [x] 在 375px ~ 414px 的常见移动端宽度下表现良好
- [x] 桌面端视觉和交互无回归

## 相关文件

- `packages/ui/src/components/song-card.tsx`
- `packages/ui/src/components/song-status-badge.tsx`
- `apps/web/src/app/[locale]/(dashboard)/songs/songs-list.tsx`（使用方，无需修改）
