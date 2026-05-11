# 歌曲/专辑分享功能设计（Issue #74）

## 背景

当前产品缺少分享功能，用户无法将自己创作的歌曲或专辑分享给他人，限制了公测期间的自然增长。Issue #74 要求：

1. 创建公开分享页，无需登录即可访问
2. 歌曲/专辑详情页添加「分享」按钮
3. 分享链接带 OG meta（社交卡片预览）

---

## 目标

- 允许创作者主动将已完成的歌曲或专辑设为公开
- 生成公开链接供社交媒体分享（复制链接、分享到 X/Twitter）
- 未登录用户可浏览公开作品信息，播放需登录
- 保证非公开作品的安全隔离（收紧匿名 RLS 策略）

---

## 非目标

- 不实现链接级控制（密码保护、过期时间、独立 token）—— 超出 Issue 范围
- 不实现微信分享（需要微信 JS-SDK 和域名备案，不在当前阶段）
- 不改动现有 explore 页面的视觉设计，仅调整数据过滤条件

---

## 方案概述

采用 **独立公开页 + 完整 OG + 按需公开** 方案：

- 数据库新增 `songs.is_public` 和 `albums.is_public`（默认 `false`）
- 新增独立公开页路由：`/[locale]/songs/[id]/public` 和 `/[locale]/albums/[id]/public`
- 详情页嵌入 `ShareButton` 客户端组件，Popover 菜单提供「复制链接」「分享到 X」
- 未公开作品首次点击分享时，调用 PATCH API 设为公开，然后复制链接
- 公开页通过 `generateMetadata` 输出动态 OG meta
- RLS 策略收紧：匿名用户仅可读 `is_public = true` 的记录

---

## 数据库变更

**迁移文件**：`supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql`

```sql
-- 给 songs 表添加公开分享开关
alter table songs add column is_public boolean not null default false;

-- 给 albums 表添加公开分享开关
alter table albums add column is_public boolean not null default false;

-- 收紧匿名读取策略：仅允许读取公开作品
drop policy if exists "anon_read_all_songs" on songs;
create policy "anon_read_public_songs"
  on songs for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_albums" on albums;
create policy "anon_read_public_albums"
  on albums for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_album_songs" on album_songs;
create policy "anon_read_public_album_songs"
  on album_songs for select
  to anon
  using (album_id in (select id from albums where is_public = true));
```

### 回滚策略

如需回滚，删除 `is_public` 列并恢复原来的 `anon_read_all_*` 策略即可。注意：删除列前已有数据会全部变为不可匿名访问（因为原策略已被 drop），回滚需要同时恢复策略和默认数据。

---

## 页面设计

### 歌曲公开页 `/[locale]/songs/[id]/public/page.tsx`

- **渲染方式**：Server Component，纯服务端渲染
- **鉴权**：无需登录。服务端尝试 `getUser()` 判断登录状态，传给客户端播放组件
- **数据查询**：
  ```ts
  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', params.id)
    .eq('is_public', true)
    .single()
  ```
  - 查不到 → `notFound()`
- **布局**：
  - 顶部：返回探索页链接
  - 封面区：复用 `CoverSection` 只读展示
  - 标题 + 流派/情绪/时长元信息
  - 音频区：已登录 → `AudioPlayer`；未登录 → 遮罩 +「登录播放」CTA
  - 歌词区：展示歌词内容
  - 底部：「在 Kiyo 上查看」按钮 → 登录后跳转私有详情页
- **按钮过滤**：移除编辑、删除、AI 翻唱、导出、生成面板等所有操作按钮

### 专辑公开页 `/[locale]/albums/[id]/public/page.tsx`

- **数据查询**：
  ```ts
  const { data: album } = await supabase
    .from('albums')
    .select('*, cover_file_path')
    .eq('id', params.id)
    .eq('is_public', true)
    .single()

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(id, title, audio_url, file_path, cover_url, cover_file_path, duration)')
    .eq('album_id', params.id)
    .order('order_index', { ascending: true })
  ```
- **布局**：
  - 封面 + 标题 + 描述
  - 歌曲列表：展示每首歌曲标题、时长，点击可播放（已登录）或提示登录
  - 专辑级 `AudioPlayer`（播放第一首歌，整个列表作为 playlist）
  - 底部 CTA

---

## OG Meta

通过 Next.js `generateMetadata` 动态输出：

| 字段 | 来源 | 备注 |
|---|---|---|
| `title` | `歌曲/专辑标题 - Kiyo` | |
| `description` | `流派 · 情绪 · Created with Kiyo` | 有限长度 |
| `og:title` | 同上 | |
| `og:description` | 同上 | |
| `og:image` | `cover_url` 优先；仅 `cover_file_path` 时用 service role 生成 7 天有效期 Signed URL；无封面用默认品牌图 | 服务端必须输出完整绝对 URL |
| `og:type` | `music.song` / `music.album` | |
| `twitter:card` | `summary_large_image` | |

**注意**：OG 爬虫不执行 JS，`og:image` 必须在 SSR 时生成绝对 URL。默认品牌图路径为 `/og-default.png`，部署为 `https://kiyo.ai/og-default.png`。

---

## ShareButton 组件

**文件**：`apps/web/src/components/share-button.tsx`

```tsx
'use client'

// Popover 菜单：
// - 若 is_public = false：
//   提示「尚未公开，设为公开后可生成分享链接」
//   按钮「设为公开并分享」→ PATCH API → 刷新页面 → 复制链接
// - 若 is_public = true：
//   「复制链接」→ navigator.clipboard.writeText(公开页完整URL)
//   「分享到 X」→ window.open(twitterIntent, '_blank')
```

**Props**：
```ts
interface ShareButtonProps {
  entityType: 'song' | 'album'
  entityId: string
  title: string
  isPublic: boolean
  locale: string
}
```

**使用位置**：
- `/songs/[id]/page.tsx`：操作按钮组（紧邻「编辑」）
- `/albums/[id]/page.tsx`：操作区（紧邻「添加歌曲」）

---

## 未登录播放体验

公开页在服务端获取 `user`：

- **已登录**：直接渲染 `AudioPlayer`，可播放
- **未登录**：
  - 音频区显示半透明暗色遮罩
  - 遮罩中央：播放图标 +「登录播放」按钮
  - 点击 → `/login?redirect=/songs/${id}/public`
  - 登录后自动跳回公开页，此时可播放

---

## Explore 页面调整

现有 `explore` 页面查询所有歌曲。迁移后需添加过滤条件：

```ts
let query = supabase
  .from('songs')
  .select('id, title, genre, mood, cover_url, cover_file_path, audio_url, file_path, duration')
  .eq('is_public', true)  // 新增
```

这样匿名用户只能看到创作者主动公开的作品。

---

## API 适配

现有 PATCH 路由无需新增，仅需允许 `is_public` 字段：
- `/api/songs/[id]/route.ts`：PATCH body 接受 `{ ..., is_public?: boolean }`
- `/api/albums/[id]/route.ts`：同上

前端 ShareButton 在未公开时直接调用现有 PATCH API 更新 `is_public`。

---

## i18n 文案

在 `messages/en.json` 和 `messages/zh.json` 中新增 `share` namespace：

```json
"share": {
  "button": "Share",
  "copyLink": "Copy Link",
  "copied": "Copied",
  "shareTwitter": "Share on X",
  "twitterText": "Created with Kiyo",
  "makePublic": "Make Public",
  "madePublic": "Made Public",
  "notPublicTitle": "Not Public Yet",
  "notPublicDesc": "Make it public so others can view and play via link",
  "makePublicAndShare": "Make Public & Share",
  "loginToPlay": "Log in to Play",
  "playOnKiyo": "View on Kiyo"
}
```

中文版本同上翻译。

---

## 错误处理

| 场景 | 行为 |
|---|---|
| 公开页访问非公开作品 | `notFound()` 404 |
| 公开页 ID 不存在 | `notFound()` 404 |
| 复制链接失败（权限等） | Popover 内显示完整链接文本供手动复制 |
| 设为公开 API 失败 | Toast 提示 `updateFailed`，不切换公开状态 |
| 未登录访问私有详情页 | 保持现有行为：重定向 `/login` |

---

## 安全考量

1. **RLS 收紧**：匿名用户只能读 `is_public = true`，无法通过遍历 ID 访问私有作品
2. **Signed URL 安全**：OG 图片的 Signed URL 在服务端用 service role 生成，不暴露给客户端
3. **API 鉴权**：PATCH `is_public` 仍受现有 RLS 保护（只能改自己的作品）

---

## 文件清单

```
新增：
├── apps/web/src/app/[locale]/songs/[id]/public/page.tsx
├── apps/web/src/app/[locale]/albums/[id]/public/page.tsx
├── apps/web/src/components/share-button.tsx
├── supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql

修改：
├── apps/web/src/app/[locale]/songs/[id]/page.tsx     (+ ShareButton)
├── apps/web/src/app/[locale]/albums/[id]/page.tsx    (+ ShareButton)
├── apps/web/src/app/[locale]/explore/page.tsx        (.eq('is_public', true))
├── apps/web/messages/en.json                         (+ share namespace)
├── apps/web/messages/zh.json                         (+ share namespace)
├── apps/web/src/app/api/songs/[id]/route.ts          (接受 is_public)
└── apps/web/src/app/api/albums/[id]/route.ts         (接受 is_public)
```

---

## 验收标准

- [ ] 歌曲/专辑详情页出现「分享」按钮
- [ ] 未公开作品点击分享后自动设为公开并复制链接
- [ ] 已公开作品点击分享可直接复制链接或分享到 X
- [ ] 公开页 `/songs/:id/public` 和 `/albums/:id/public` 无需登录可访问
- [ ] 公开页展示封面、标题、元信息、歌词、播放列表
- [ ] 未登录用户在公开页看到「登录播放」遮罩，点击跳转登录
- [ ] 已登录用户在公开页可直接播放
- [ ] 分享链接在社交媒体（Twitter/X、Telegram 等）显示卡片预览（OG meta）
- [ ] 非公开作品访问公开页返回 404
- [ ] Explore 页面仅展示 `is_public = true` 的作品
