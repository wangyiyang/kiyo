# 专辑管理功能设计文档

> 对应 Issue: [#7 Implement album management APIs and frontend](https://github.com/wangyiyang/kiyo/issues/7)

## 目的

实现专辑的创建、查询、更新、删除功能，支持从歌曲库中选择歌曲组成专辑，并支持拖拽调整歌曲顺序。

## 背景

- 数据库 schema 已就绪（`albums`、`album_songs`、`songs` 三表 + RLS 策略）
- AI 服务包 `@kiyo/ai` 已就位（封面生成由独立 Issue #8 处理）
- 前端目前只有基础 `layout.tsx` + `page.tsx`，无歌曲库页面

## 方案概述

采用 **Route Handlers + Server/Client 混合架构**：

- 列表页（`/songs`、`/albums`）使用 Server Component 直连数据库首屏直出
- 弹窗、表单、拖拽排序使用 Client Component 通过 `fetch` 调用 REST API
- API Routes 作为 BFF 层，可被未来移动端或其他客户端复用

## 路由与页面结构

### 新增页面路由

| 路由 | 类型 | 职责 |
|------|------|------|
| `/songs` | Server Component | 歌曲库列表页，展示当前用户所有歌曲 |
| `/albums` | Server Component | 专辑列表页，展示当前用户所有专辑 |
| `/albums/[id]` | Server Component | 专辑详情页，展示专辑信息 + 可拖拽歌曲列表 |

### 新增 API 路由

| 路由 | 方法 | 职责 |
|------|------|------|
| `/api/albums` | `POST` | 创建专辑 + 校验 `song_ids` 归属权 + 写入 `album_songs` |
| `/api/albums` | `GET` | 获取当前用户专辑列表 |
| `/api/albums/[id]` | `GET` | 获取专辑详情（JOIN `album_songs` + `songs`） |
| `/api/albums/[id]` | `PATCH` | 更新专辑信息 + 原子替换 `album_songs`（支持改顺序） |
| `/api/albums/[id]` | `DELETE` | 删除专辑（`ON DELETE CASCADE` 自动清理关联） |
| `/api/songs` | `GET` | 获取当前用户歌曲列表（供弹窗选择时调用） |

## 组件拆分

### 页面级 Server Components

| 组件 | 文件 | 职责 |
|------|------|------|
| `SongsPage` | `app/songs/page.tsx` | 服务端获取歌曲列表，渲染 `SongList` |
| `AlbumsPage` | `app/albums/page.tsx` | 服务端获取专辑列表，渲染 `AlbumList` + 「新建专辑」按钮 |
| `AlbumDetailPage` | `app/albums/[id]/page.tsx` | 服务端获取专辑详情 + 歌曲列表，渲染专辑信息 + `DraggableSongList` |

### 纯展示 UI 组件

| 组件 | 归属 | 职责 |
|------|------|------|
| `AlbumCard` | `packages/ui` | 专辑卡片：封面占位区、标题、歌曲数量、创建时间 |
| `SongRow` | `packages/ui` | 歌曲行：标题、时长占位、选择 checkbox |
| `EmptyState` | `packages/ui` | 空状态：无歌曲/无专辑时的占位图 + 提示文案 |

### Client 交互组件

| 组件 | 文件 | 职责 |
|------|------|------|
| `AlbumFormDialog` | `app/albums/_components/AlbumFormDialog.tsx` | 创建/编辑弹窗：标题输入、描述输入、嵌入 `SongSelector`、提交时调 `POST/PATCH` API |
| `SongSelector` | `app/albums/_components/SongSelector.tsx` | 歌曲选择器：调 `GET /api/songs`、支持搜索过滤、多选 checkbox、已选歌曲按选择顺序展示 |
| `DraggableSongList` | `app/albums/_components/DraggableSongList.tsx` | 可拖拽列表：基于 `@dnd-kit/core` + `@dnd-kit/sortable`，每行显示歌曲名 + 拖拽手柄，拖拽结束后调 `PATCH /api/albums/[id]` 更新顺序 |
| `DeleteConfirmDialog` | `app/albums/_components/DeleteConfirmDialog.tsx` | 删除确认：调 `DELETE /api/albums/[id]` |

### 组件复用策略

- `SongRow` 在 `SongSelector`（弹窗内选择态）和 `DraggableSongList`（详情页排序态）中复用，通过 `mode: 'select' | 'drag'` 区分
- `AlbumCard` 在专辑列表页复用，后续 Issue #8（封面生成）直接替换封面占位区即可

## 数据流

### Server Component 数据流（首屏直出）

```text
AlbumsPage ──createServerClient()──→ Supabase ──→ 渲染 AlbumList
AlbumDetailPage ──createServerClient()──→ Supabase (JOIN album_songs + songs) ──→ 渲染详情
SongsPage ──createServerClient()──→ Supabase ──→ 渲染 SongList
```

Server Component 直接通过 `createServerClient()` 查询数据库，不走 HTTP API，减少一次网络往返。

### Client Component 数据流（交互场景）

```text
AlbumFormDialog ──fetch POST /api/albums──→ Route Handler ──createServerClient()──→ Supabase
DraggableSongList ──fetch PATCH /api/albums/[id]──→ Route Handler ──createServerClient()──→ Supabase
```

## API 契约

### 请求/响应格式

| 端点 | 请求体 | 响应体 | 关键校验 |
|------|--------|--------|----------|
| `POST /api/albums` | `{ title, description?, song_ids: string[] }` | `{ id, title, ... }` | `song_ids` 必须全部属于当前用户 |
| `GET /api/albums` | - | `{ albums: [...] }` | `user_id = auth.uid()`（RLS 兜底） |
| `GET /api/albums/:id` | - | `{ album, songs: [...] }` | 专辑必须属于当前用户 |
| `PATCH /api/albums/:id` | `{ title?, description?, song_ids?: string[] }` | `{ ... }` | `song_ids` 归属权校验 + 原子替换 `album_songs` |
| `DELETE /api/albums/:id` | - | `{ success: true }` | `ON DELETE CASCADE` 自动清理关联 |
| `GET /api/songs` | - | `{ songs: [...] }` | `user_id = auth.uid()` |

### `song_ids` 归属权校验逻辑

`POST /api/albums` 和 `PATCH /api/albums/:id` 时执行：

1. 读取当前用户 id（from auth）
2. 查询 songs 表：`SELECT id FROM songs WHERE id IN (song_ids) AND user_id = auth.uid()`
3. 如果返回数量 < `song_ids.length` → 返回 `400 Bad Request`（存在不属于自己的歌曲）
4. 通过校验后，事务内执行：INSERT/DELETE `album_songs` + UPDATE `albums`

### 数据库事务边界

专辑更新（`PATCH`）涉及两张表：`albums` 和 `album_songs`。为保证原子性，在 Route Handler 中按顺序执行：

1. 删除该专辑所有 `album_songs` 记录
2. 按新顺序重新 INSERT `album_songs`
3. UPDATE `albums` 主表信息

（当前 schema 无存储过程/RPC，用应用层顺序执行 + 错误回滚实现。）

## 错误处理

### API 错误统一格式

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### 错误码映射

| 场景 | HTTP Status | Error Code |
|------|-------------|------------|
| 参数校验失败 | `400` | `VALIDATION_ERROR` |
| `song_ids` 包含非本人歌曲 | `403` | `FORBIDDEN_SONGS` |
| 专辑不存在 | `404` | `ALBUM_NOT_FOUND` |
| 未登录 | `401` | `UNAUTHORIZED` |
| 服务端异常 | `500` | `INTERNAL_ERROR` |

### 前端错误处理

- **API 调用层**：`fetch` 封装统一处理 HTTP 错误，非 2xx 时抛出含 `error.code` 的异常
- **UI 层**：`AlbumFormDialog` / `DraggableSongList` 用 `try/catch` 捕获，通过 shadcn/ui 的 `Toast` / `Alert` 展示用户友好提示
- **加载态**：提交按钮显示 Loading，禁用二次提交

### 乐观更新 vs 保守更新

| 场景 | 策略 | 理由 |
|------|------|------|
| 创建/编辑专辑 | 保守更新 | 提交成功后弹窗关闭 + 列表页刷新（`router.refresh()`） |
| 拖拽排序 | 保守更新 | 拖拽结束后调 PATCH，成功后更新本地状态；失败时回滚到原顺序 |

## 权限与兜底

- **第一层**：`middleware.ts` 已配置 Supabase session 刷新，未登录用户无法进入 `/albums`、`/songs`
- **第二层**：RLS 策略兜底，即使绕过前端直接调 API，数据库也只返回当前用户数据
- **第三层**：Route Handler 中显式校验 `song_ids` 归属权（防止 A 用户用 B 用户的 song_id 创建专辑）

## 测试策略

### API 路由测试（重点）

使用 `vitest` 为每个 Route Handler 编写单元测试：

| 测试文件 | 覆盖场景 |
|----------|----------|
| `app/api/albums/route.test.ts` | 创建成功、创建时 `song_ids` 含非本人歌曲（403）、未登录（401）、参数缺失（400） |
| `app/api/albums/[id]/route.test.ts` | 获取详情成功、详情含歌曲列表、更新专辑+顺序、删除专辑、操作他人专辑（404） |
| `app/api/songs/route.test.ts` | 获取歌曲列表成功、未登录（401） |

测试环境：Mock Supabase client（注入测试 user_id），不连接真实数据库。

### 组件测试（可选，本期优先级低）

- `AlbumFormDialog`：表单校验、提交调用、错误提示
- `DraggableSongList`：拖拽事件触发、顺序更新回调

### E2E 测试（Playwright，本期不做）

专辑管理的完整用户旅程（创建 → 查看 → 编辑 → 删除）留在后续迭代，本期聚焦 API 和核心交互。

## 影响与风险

| 风险点 | 影响 | 缓解措施 |
|--------|------|----------|
| `@dnd-kit` 引入新依赖 | 构建体积增加 | 仅引入 `@dnd-kit/core` + `@dnd-kit/sortable`，按需加载 |
| `PATCH` 原子性不足 | 并发更新可能数据不一致 | 当前用应用层顺序执行，后续如并发量大可迁移为 Supabase RPC 事务 |
| 前端页面从零搭建 | 工作量比纯 API 大 | 歌曲列表页和专辑列表页结构类似，组件可复用 |

## 验收标准

- [ ] 用户可创建包含多首歌曲的专辑
- [ ] 专辑中歌曲按选择顺序排列，支持拖拽调整顺序
- [ ] 只能将自己歌曲库中的歌曲加入专辑
- [ ] 删除专辑不影响歌曲本身
- [ ] 歌曲库列表页可独立访问和展示
- [ ] API 路由通过单元测试
