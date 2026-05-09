# 歌曲封面生成与上传设计文档

> Issue: #50 | 日期: 2026-05-09 | 状态: 已批准

## 目的

为歌曲添加封面设置能力，解决歌曲列表和详情页封面始终为空的问题。支持 AI 生成封面和手动上传封面两种方式。

## 背景

- `songs` 表已有 `cover_url` 字段，但 nowhere 可用
- `SongCard` 和 `AudioPlayer` 已支持 `coverUrl` 展示
- 专辑封面生成已完整实现，歌曲需要相同能力
- 被标记为 P0 公测 Blocker

## 方案概述

采用**共享逻辑提取**方案（方案 B）：
- 提取专辑和歌曲共用的封面逻辑到 `lib/cover.ts`
- 统一 `CoverSection` 组件，支持 `album | song` 两种类型
- 统一 API 路由模式：`POST /api/{type}/{id}/cover?action=generate|upload`
- 消除代码重复，保持与专辑封面一致的用户体验

## 架构

```
Song Detail Page
    │
    ▼
CoverSection (通用组件, entityType='song')
    │
    ├── 点击「生成封面」
    │   └── POST /api/songs/{id}/cover?action=generate
    │       ├── 调用 Minimax generateImage
    │       ├── 下载图片 → 上传 Storage
    │       └── 更新 songs.cover_url / cover_status
    │
    └── 点击「上传封面」
        └── POST /api/songs/{id}/cover?action=upload
            ├── 直接上传文件到 Storage
            └── 更新 songs.cover_url / cover_status
```

## 共享层设计

### `apps/web/src/lib/cover.ts`

| 函数 | 职责 |
|------|------|
| `buildCoverPrompt(type, data)` | 构造 Minimax prompt。album: `专辑: {title}。{description}`；song: `歌曲: {title}，风格：{genre}，情绪：{mood}` |
| `downloadImage(url)` | fetch 下载图片，返回 ArrayBuffer |
| `uploadToCovers(supabase, filePath, buffer)` | 上传 covers bucket，返回 publicUrl |

## API 设计

### 重构：`POST /api/albums/[id]/cover`

Query: `?action=generate`（兼容现有调用）

Body (upload 时): `FormData` with `file` field

### 新建：`POST /api/songs/[id]/cover`

**Query 参数：**
- `action=generate` — AI 生成封面
- `action=upload` — 手动上传封面

**generate 流程：**
1. 校验登录 → 查询歌曲 → 校验所有权
2. 更新 `cover_status='generating'`
3. `buildCoverPrompt('song', {title, genre, mood})`
4. 调用 `generateImage({prompt, width: 1024, height: 1024})`
5. `downloadImage(imageUrl)` → `uploadToCovers(...)`
6. 更新 `cover_url` + `cover_status='completed'`
7. 异常时更新 `cover_status='failed'`

**upload 流程：**
1. 校验登录 → 查询歌曲 → 校验所有权
2. 从 FormData 读取文件，校验类型（image/*）和大小（≤5MB）
3. 直接上传 Storage：`{user_id}/{song_id}/{timestamp}.{ext}`
4. 更新 `cover_url` + `cover_status='completed'`

**错误响应：**
| 场景 | HTTP | Code |
|------|------|------|
| 未登录 | 401 | UNAUTHORIZED |
| 歌曲不存在 | 404 | NOT_FOUND |
| 无权访问 | 403 | FORBIDDEN |
| 无效 action | 400 | VALIDATION_ERROR |
| 文件类型/大小不符 | 400 | VALIDATION_ERROR |
| Minimax 失败 | 422 | GENERATION_FAILED |
| Storage 失败 | 500 | INTERNAL_ERROR |

## 组件设计

### `CoverSection`（通用化重构）

**Props：**
```typescript
interface CoverSectionProps {
  entityId: string
  entityType: 'album' | 'song'
  coverUrl: string | null
  coverStatus: string
  title: string
  genre?: string | null   // song only
  mood?: string | null    // song only
}
```

**状态映射：**
| cover_status | 视觉 | 按钮 |
|-------------|------|------|
| none | 占位图标 | 「生成封面」+「上传封面」 |
| generating | Skeleton 脉冲 | disabled |
| completed | 封面图片 | 「重新生成」+「更换封面」 |
| failed | 占位 + 红色提示 | 「重试」+「上传封面」 |

**上传交互：**
- 点击「上传封面」→ 触发隐藏 `<input type="file" accept="image/*">`
- 选择文件后立即上传，显示 loading
- 成功/失败显示对应状态

## 前端集成

### 歌曲详情页 (`/songs/[id]/page.tsx`)

在标题区域上方插入 `CoverSection`：

```tsx
<CoverSection
  entityId={song.id}
  entityType="song"
  coverUrl={song.cover_url}
  coverStatus={song.cover_status ?? 'none'}
  title={song.title}
  genre={song.genre}
  mood={song.mood}
/>
```

### 歌曲编辑页

不处理封面，保持现状。

## 数据库变更

```sql
-- songs 表添加 cover_status（与 albums 保持一致）
alter table songs add column cover_status text not null default 'none';
```

## i18n 文案

在 `songs.detail` 命名空间下新增：

```json
"cover": {
  "generate": "生成封面",
  "regenerate": "重新生成",
  "upload": "上传封面",
  "replace": "更换封面",
  "generating": "生成中...",
  "retry": "重试",
  "error": "生成失败，请重试"
}
```

英文对应翻译同步添加。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/lib/cover.ts` | 新建 | 共享封面逻辑 |
| `apps/web/src/app/api/albums/[id]/generate-cover/route.ts` | 删除 | 被重构替代 |
| `apps/web/src/app/api/albums/[id]/cover/route.ts` | 新建 | 重构后的统一路由 |
| `apps/web/src/app/api/albums/[id]/cover/route.test.ts` | 新建 | 重构后的测试 |
| `apps/web/src/app/api/songs/[id]/cover/route.ts` | 新建 | 歌曲封面 API |
| `apps/web/src/app/api/songs/[id]/cover/route.test.ts` | 新建 | 歌曲封面测试 |
| `apps/web/src/components/CoverSection.tsx` | 新建 | 通用封面组件 |
| `apps/web/src/app/albums/[id]/_components/CoverSection.tsx` | 删除 | 被通用组件替代 |
| `apps/web/src/app/albums/[id]/page.tsx` | 修改 | 使用通用 CoverSection |
| `apps/web/src/app/songs/[id]/page.tsx` | 修改 | 插入 CoverSection |
| `apps/web/messages/zh.json` | 修改 | 添加 songs.detail.cover 文案 |
| `apps/web/messages/en.json` | 修改 | 添加英文翻译 |
| `supabase-local/migrations/` | 新增 | songs.cover_status 字段 |

## 测试策略

### API 测试

**`apps/web/src/app/api/songs/[id]/cover/route.test.ts`**
- 未登录 → 401
- 歌曲不存在 → 404
- 无权访问 → 403
- action 缺失/无效 → 400
- generate 成功 → 200，cover_status=completed
- generate Minimax 失败 → 422，cover_status=failed
- generate 下载失败 → 500，cover_status=failed
- generate Storage 失败 → 500，cover_status=failed
- upload 成功 → 200，cover_url 更新
- upload 文件过大 → 400
- upload 非图片 → 400

### 组件测试

**`apps/web/src/components/CoverSection.test.tsx`**
- 各状态正确渲染（none/completed/generating/failed）
- 点击生成，成功流转
- 点击生成，失败流转
- 点击上传，成功流转
- generating 时按钮 disabled

## 验收标准

- [ ] 歌曲详情页展示封面区域（无封面时显示占位图标）
- [ ] 点击「生成封面」后，cover_status 变为 generating
- [ ] 生成成功后封面自动展示，cover_status=completed
- [ ] 生成失败时 cover_status=failed，可重试
- [ ] 点击「上传封面」可选择本地图片并展示
- [ ] 封面上传路径符合 `{user_id}/{song_id}/{timestamp}.png` 规范
- [ ] 歌曲列表页封面正常展示（已有 SongCard 支持）
- [ ] AudioPlayer 封面正常展示（已有支持）
- [ ] API 测试覆盖所有边界场景
- [ ] 组件测试覆盖状态流转
- [ ] 专辑封面功能不受影响（重构后回归通过）

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 重构专辑封面引入回归 | 专辑封面功能损坏 | 保留完整测试，重构后运行专辑测试验证 |
| Vercel API 超时 | 生成失败 | 状态标记 failed，用户可重试 |
| 用户上传大图片 | 存储/加载慢 | 前端限制 5MB，后续可加图片压缩 |

## 影响范围

- 专辑详情页：CoverSection 组件替换，无功能变化
- 歌曲详情页：新增封面区域
- 歌曲编辑页：无变化
- 歌曲列表页：无代码变化（已有 coverUrl 支持）
