# 专辑详情页支持添加歌曲（Issue #38）

## 背景

专辑详情页目前可以展示已关联的歌曲列表并支持拖拽排序，但缺少向已有专辑添加歌曲的 UI 入口。用户只能在创建专辑时选择歌曲，无法后续补充。

## 目标

在专辑详情页提供"添加歌曲"功能，允许用户从自己的歌曲库中选择尚未加入该专辑的歌曲进行多选添加，添加后自动追加到列表末尾并实时更新。

## 方案

采用新增独立 API 路由 + 复用选择器组件的方案。

## API 设计

### `POST /api/albums/:id/songs`

**请求体：**
```json
{ "song_ids": ["uuid", "uuid"] }
```

**行为：**
1. 校验用户登录（401）
2. 校验专辑存在且属于当前用户（404）
3. 校验所有 `song_ids` 属于当前用户（403）
4. 查询该专辑当前最大 `order_index`
5. 增量插入 `album_songs`，新歌曲的 `order_index` = `max + 1, max + 2, ...`
6. 返回 `{ added: number }`

**错误码：** 保持现有风格
- `UNAUTHORIZED` — 未登录
- `NOT_FOUND` — 专辑不存在
- `FORBIDDEN` — 包含非当前用户拥有的歌曲
- `VALIDATION_ERROR` — `song_ids` 格式非法（非数组、空数组、含非字符串）
- `INTERNAL_ERROR` — 数据库操作失败

**并发与重复：**
- `order_index` 基于当前最大值计算，暂不加行锁（业务场景简单，并发概率极低）
- `album_songs` 复合主键 `(album_id, song_id)` 天然防重，冲突时返回 500

## 前端设计

### 新增组件：`AddSongsDialog`

**位置：** `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx`

- 以 `Dialog` 弹窗形式呈现
- 复用 `SongSelector` 组件进行歌曲搜索和多选
- 底部显示"已选择 N 首" + 取消/添加按钮
- 提交时调用 `POST /api/albums/:id/songs`
- 成功：关闭弹窗，`router.refresh()` 刷新页面
- 失败：弹窗内 `alert()` 显示错误（与现有 `AlbumFormDialog` 风格一致）

### 组件改造：`SongSelector`

**位置：** `apps/web/src/app/albums/_components/SongSelector.tsx`

新增 props：
- `excludeIds?: string[]` — 过滤掉已在专辑中的歌曲
- `emptyMessage?: string` — 空状态提示文案（默认"没有找到匹配的歌曲"）

`AddSongsDialog` 传入 `excludeIds={当前专辑歌曲 id 列表}`，`emptyMessage="暂无可用歌曲"`。

### 页面改造：`AlbumDetailPage`

**位置：** `apps/web/src/app/albums/[id]/page.tsx`

- "歌曲列表"标题栏右侧增加"添加歌曲"按钮
- 将当前专辑的 `songs.map(s => s.id)` 作为 `excludeIds` 传入 `AddSongsDialog`
- 保留现有的 `DraggableSongList` 和 `EmptyState`

## 数据流

```
用户点击"添加歌曲"
  → AddSongsDialog 打开
  → SongSelector 调用 GET /api/songs
  → 过滤 excludeIds 后展示可选歌曲列表
  → 用户勾选 → 点击"添加"
  → POST /api/albums/:id/songs
  → 成功：关闭弹窗 + router.refresh()
  → 失败：alert 错误信息
```

## 测试覆盖

### API 测试（`route.test.ts`）

- 成功向专辑添加多首歌曲（200）
- 空 `song_ids` 数组返回验证错误（400）
- 包含非当前用户拥有的歌曲返回 403
- 专辑不存在返回 404
- 未登录返回 401

## 文件变更清单

| 文件路径 | 操作 |
|----------|------|
| `apps/web/src/app/api/albums/[id]/songs/route.ts` | 新建 |
| `apps/web/src/app/api/albums/[id]/songs/route.test.ts` | 新建 |
| `apps/web/src/app/albums/[id]/_components/AddSongsDialog.tsx` | 新建 |
| `apps/web/src/app/albums/_components/SongSelector.tsx` | 编辑（添加 props） |
| `apps/web/src/app/albums/[id]/page.tsx` | 编辑（添加按钮） |

## 非目标（明确排除）

- 不支持从专辑中移除歌曲（现有 PATCH 仍负责全量替换）
- 不支持批量添加时自定义插入位置（始终追加到末尾）
- 不支持跨用户分享/添加歌曲（RLS 保持严格）
