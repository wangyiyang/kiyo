# Issue 158: 专辑列表歌曲数量与详情页不一致 — 设计文档

## 问题

专辑列表页调用了一个不存在的 `/api/albums/song-counts` API，导致歌曲数量始终显示为 `0`，与详情页实际数据不一致。

## 方案：列表接口内嵌歌曲数量（方案 B）

### 后端改动

文件：`apps/web/src/app/api/albums/route.ts`

将 GET 端点中的 Supabase 查询从 `.select('*')` 改为：

```ts
.select('*, album_songs(count)')
```

Supabase 会将关联的 `album_songs` 数量返回为数组：

```ts
album.album_songs = [{ count: 3 }]
```

接口返回的专辑数据已包含该字段，前端直接使用，无需额外请求。

### 前端改动

文件：`apps/web/src/app/[locale]/albums/page.tsx`

1. 在 `Album` 接口中增加可选字段 `album_songs?: { count: number }[]`
2. 移除 `songCounts` state 及其 `useState` 声明
3. 移除对 `/api/albums/song-counts` 的 POST 请求逻辑
4. 将 `AlbumCard` 的 `songCount` prop 从 `songCounts[album.id] ?? 0` 改为 `album.album_songs?.[0]?.count ?? 0`

### 删除内容

- 不创建 `/api/albums/song-counts` 路由（此前前端调用的不存在的接口）
- 移除 `useState<Record<string, number>>` 及相关 fetch 逻辑

### 测试与验收

- 新建专辑并选择歌曲后，列表页卡片立即显示正确数量
- 刷新页面后数量依然正确
- 专辑详情页歌曲数量与列表一致
