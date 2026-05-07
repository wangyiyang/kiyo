# Album Cover Generation Design

## 目的

为专辑集成 Minimax 文生图能力，在专辑详情页提供「生成封面」功能，自动生成并展示专辑封面。

## 背景

- GitHub Issue #8 要求集成 Minimax 文生图能力为专辑自动生成封面
- 数据库层面 `albums` 表已有 `cover_url` 和 `cover_status` 字段
- `packages/ai` 已实现 Minimax `generateImage` 调用能力
- Supabase Storage `covers` bucket 及 RLS 策略已配置完成
- 前端 `AlbumCard` 已支持 `coverUrl` 展示

当前缺失：**生成封面的 API 路由**、**Storage 上传逻辑**、**专辑详情页封面交互**。

## 方案概述

采用**单 API 路由同步全流程**方案：

```
前端点击 → POST /api/albums/:id/generate-cover → 验证权限 → 构造 prompt
→ 调用 Minimax 生图 → 下载图片 → 上传 Storage → 更新数据库 → 返回结果
```

理由：项目当前无异步任务基础设施，此方案最贴合现有架构；Issue 8 验收标准明确为同步状态流转。

## 架构与数据流

```
[Album Detail Page] ──POST──► [API Route]
                                   │
                                   ▼
                         [1. 权限验证]
                         [2. 构造 Prompt]
                         [3. 调用 Minimax]
                         [4. 下载图片]
                         [5. 上传 Storage]
                         [6. 更新数据库]
                         [7. 返回结果]
```

### 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| Prompt 构造 | `专辑: {title}。{description}` | 简单直接，description 为空时省略后半句 |
| 上传路径 | `{user_id}/{album_id}/{timestamp}.png`（`covers` bucket 内） | 符合 RLS 策略（路径以 user_id 开头），防覆盖 |
| 旧封面处理 | 不主动删除旧文件 | 简化实现；后续可配 cleanup |
| 图片尺寸 | 1024x1024 | 平衡质量与生成速度 |

### 状态流转

```
none ──[点击生成]──► generating ──[成功]──► completed
                         │
                         └──[失败]──► failed ──[可重试]──► generating
```

## API 设计

### POST /api/albums/:id/generate-cover

**请求**: 无 Body，路径参数 `id` 为专辑 UUID

**成功响应 (200)**:
```json
{
  "coverUrl": "https://xxx.supabase.co/storage/v1/object/public/covers/...",
  "coverStatus": "completed"
}
```

**错误响应**:
- `401 Unauthorized` — 未登录
- `403 Forbidden` — 专辑不属于当前用户
- `404 Not Found` — 专辑不存在
- `422 Unprocessable Entity` — Minimax 生图失败
- `500 Internal Server Error` — 上传 Storage 失败或其他内部错误

### 实现逻辑（route.ts）

1. 获取当前用户，未登录返回 401
2. 查询专辑，验证存在性和所有权
3. 更新 `cover_status` 为 `generating`
4. 构造 prompt，调用 `generateImage({ prompt, width: 1024, height: 1024 })`
5. 下载生成的图片（`fetch(imageUrl)` → `ArrayBuffer`）
6. 上传至 `covers` bucket：`supabase.storage.from('covers').upload(path, buffer)`
7. 获取 public URL，更新 `albums.cover_url` 和 `cover_status='completed'`
8. 任何异常捕获后，更新 `cover_status='failed'`，返回对应错误码

## 前端设计

### 变更页面

`apps/web/src/app/albums/[id]/page.tsx` — 专辑详情页顶部增加封面区域。

### 新增组件

`apps/web/src/app/albums/[id]/_components/CoverSection.tsx`（Client Component）

### 状态映射

| `cover_status` | 视觉表现 | 按钮文案 |
|---|---|---|
| `none` | 灰色占位区 + `Disc3` 图标 | 「生成封面」 |
| `generating` | `Skeleton` 脉冲动画，按钮 disabled | 「生成中...」 |
| `completed` | 展示 `cover_url` 图片 | 「重新生成」 |
| `failed` | 占位区 + 红色错误提示 | 「重试」 |

### 交互流程

1. 用户点击按钮，本地状态变为 `generating`，按钮 disabled
2. 调用 `POST /api/albums/:id/generate-cover`
3. 成功：更新 `coverUrl` 和状态为 `completed`，展示图片
4. 失败：更新状态为 `failed`，显示 toast 错误提示

## 测试策略

### API 路由测试

文件：`apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts`

覆盖场景：
- 未登录 → 401
- 专辑不存在 → 404
- 权限不足 → 403
- 成功生成 → 200，数据库状态变为 `completed`
- Minimax 错误 → 422，数据库状态变为 `failed`
- Storage 上传失败 → 500，数据库状态变为 `failed`
- 下载图片失败 → 500，数据库状态变为 `failed`

Mock 策略：`vi.mock('@kiyo/ai')` mock `generateImage`；`vi.mock('@/supabase/client')` mock Supabase；`globalThis.fetch` mock 图片下载。

### 前端组件测试

文件：`apps/web/src/app/albums/[id]/_components/CoverSection.test.tsx`

覆盖场景：
- 各状态下正确渲染（占位、图片、Skeleton、错误提示）
- 点击生成，成功流转（`none` → `generating` → `completed`）
- 点击生成，失败流转（`none` → `generating` → `failed`）
- 按钮在 `generating` 时 disabled

## 影响与风险

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| Vercel API Route 超时 | Hobby plan 默认 10s，可能不足 | 确认部署 plan；如超时问题出现，后续迁移异步方案 |
| Minimax 服务不稳定 | 生成失败 | 状态标记 `failed`，用户可重试 |
| Storage 上传失败 | 生成成功但无法保存 | 同上，异常捕获后标记 `failed` |

## 验收标准

- [ ] 专辑详情页展示封面区域（无封面时显示占位）
- [ ] 点击「生成封面」后，`cover_status` 变为 `generating`
- [ ] 生成成功后封面自动展示，状态变为 `completed`
- [ ] 生成失败时状态变为 `failed`，用户可重试
- [ ] 封面上传路径符合 `covers/{user_id}/{album_id}/{timestamp}.png` 规范
- [ ] API 路由测试覆盖所有边界场景
- [ ] 前端组件测试覆盖状态流转
