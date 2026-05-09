# Next.js Image 组件优化设计方案

**Issue**: GitHub #61  
**日期**: 2026-05-09  
**状态**: 已批准

## 背景

当前 `packages/ui` 中的图片组件使用原生 `<img>` 标签，未利用 Next.js Image 组件的自动优化、懒加载、WebP/AVIF 转换等能力。

## 目标

将所有 `<img>` 替换为 `next/image` 的 `Image` 组件，提升性能分数。

## 修改范围

| 文件 | 修改内容 |
|------|---------|
| `packages/ui/src/components/song-card.tsx` | `<img>` → `<Image>` |
| `packages/ui/src/components/album-card.tsx` | `<img>` → `<Image>` |
| `packages/ui/src/components/audio-player/AudioPlayer.tsx` | `<img>` → `<Image>` |
| `packages/ui/src/components/audio-player/PlaylistPanel.tsx` | `<img>` → `<Image>` |
| `packages/ui/src/components/audio-player/MiniPlayer.tsx` | `<img>` → `<Image>` |

## 技术决策

### 1. 占位策略

使用 `bg-muted` 作为骨架屏 fallback，不依赖后端 blurDataURL。

```tsx
<div className="relative aspect-video overflow-hidden rounded-md bg-muted">
  {coverUrl ? (
    <Image src={coverUrl} alt={title} fill className="object-cover" sizes="..." />
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <Music2 className="h-8 w-8 text-muted-foreground/50" />
    </div>
  )}
</div>
```

### 2. `sizes` 配置（精确策略）

| 组件 | 布局特征 | `sizes` 配置 |
|------|---------|-------------|
| `SongCard` | `aspect-video`，响应式列数 | `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px` |
| `AlbumCard` | `aspect-square`，响应式网格 | `(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px` |
| `AudioPlayer` | 固定 `h-20 w-20` (80px) | `80px` |
| `PlaylistPanel` | 固定 `h-8 w-8` (32px) | `32px` |
| `MiniPlayer` | 固定 `h-10 w-10` (40px) | `40px` |

### 3. 懒加载策略

除 `CoverSection`（已有 Next.js Image）外，其余组件均为列表项或播放器内部图片，不设置 `priority`，默认懒加载。

### 4. 外部域名

`next.config.js` 中已配置 `remotePatterns` 包含 `**.supabase.co`，无需额外修改。

## 测试策略

- 类型检查：确保 TypeScript 编译通过
- ESLint：验证无遗漏的原生 `<img>` 标签
- 构建验证：`pnpm build` 通过

## 验收标准

1. `pnpm build` 成功，无类型错误
2. Lighthouse / PageSpeed 性能分数提升
3. 所有图片正常显示，无布局偏移
