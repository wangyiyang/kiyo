# 复盘：首页/Explore 歌曲封面和音频无法加载

## 结论

2026-05-12，生产环境（kiyo.wangyiyang.cc）出现首页 Showcase 和 Explore 页面歌曲封面不显示、歌曲无法播放的问题。根因是代码优先通过 `/api/storage/sign` 获取签名 URL，但该 API 因缺少 `SUPABASE_SERVICE_ROLE_KEY` 环境变量返回 500，且前端未正确处理失败 fallback。

已通过修改前端代码优先使用公开 URL（`cover_url` / `audio_url`）解决，并推送部署。同时需在 Vercel 补配 `SUPABASE_SERVICE_ROLE_KEY` 环境变量。

---

## 背景

本次问题涉及两个独立的变更叠加：

1. **数据库迁移 `add_is_public_to_songs_albums`**：给 `songs` 和 `albums` 表添加了 `is_public` 列，用于公开分享功能
2. **数据库迁移 `add_cover_file_path`**：给 `songs` 和 `albums` 表添加了 `cover_file_path` 列，用于私有桶存储迁移

代码已更新使用新字段，但线上数据库缺少这些列，导致查询返回空结果。

---

## 问题分析

### 现象

- 首页 Showcase 区域歌曲封面不显示（显示渐变色占位）
- Explore 页面歌曲封面不显示
- 点击播放按钮歌曲无法播放

### 根因分层

#### 第一层：数据库迁移未同步到生产

线上数据库缺少以下迁移的执行结果：

- `20260513000000_add_is_public_to_songs_albums.sql`：`is_public` 列缺失
- `20260511190000_add_cover_file_path.sql`：`cover_file_path` 列缺失

**验证**：通过 Supabase REST API 查询，`.eq("is_public", true)` 返回 column does not exist 错误。

#### 第二层：签名 API 500 错误

修复数据库后，歌曲数据已能查询到，但封面和音频仍无法加载。

**验证**：直接 curl `/api/storage/sign` 接口：

```bash
curl -X POST https://kiyo.wangyiyang.cc/api/storage/sign \
  -H "Content-Type: application/json" \
  -d '{"bucket":"covers","path":"..."}'
# 返回 HTTP 500
```

**根因**：`createServiceRoleClient()` 需要 `SUPABASE_SERVICE_ROLE_KEY` 环境变量，Vercel 生产环境未配置该变量，导致 `throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')`。

#### 第三层：前端未正确处理签名失败

代码逻辑优先使用 `cover_file_path` / `file_path` 获取签名 URL，签名失败时：

- **封面**（`showcase-card.tsx`）：`getSignedCoverUrl` 返回 null，`setCoverUrl(null)` 导致不显示封面
- **音频**（`AudioEngine.tsx`）：`fetchSignedUrl` 抛异常后 `return`，音频根本不会加载

#### 第四层：公开桶无需签名

从数据库数据观察，现有 `cover_url` 和 `audio_url` 的格式均为：

```
https://xxx.supabase.co/storage/v1/object/public/covers/...
https://xxx.supabase.co/storage/v1/object/public/audio/...
```

URL 中包含 `/object/public/`，说明 `covers` 和 `audio` 桶本身是**公开桶**，公开桶的文件可直接通过 URL 访问，不需要签名 URL。

---

## 修复方案

### 已执行

1. **应用缺失的数据库迁移**（通过 Supabase MCP）
   - `add_is_public_to_songs_albums`：添加 `is_public` 列、索引、RLS 策略
   - `add_cover_file_path`：添加 `cover_file_path` 列并迁移现有数据
   - 将现有所有歌曲 `is_public` 设为 `true`

2. **修改前端代码优先使用公开 URL**（commit `8e170b4`）
   - `showcase-card.tsx`：签名失败时 fallback 到 `cover_url`
   - `AudioPlayer.tsx`：优先使用 `coverUrl`，不存在时才尝试签名
   - `AudioEngine.tsx`：优先使用 `audio_url`，不存在时才尝试签名

### 待执行

3. **补配环境变量**（Vercel Dashboard）
   - 变量名：`SUPABASE_SERVICE_ROLE_KEY`
   - 获取位置：Supabase Dashboard → Project Settings → API → service_role key
   - 配置位置：Vercel Dashboard → 项目 → Settings → Environment Variables

---

## 影响与风险

| 影响项 | 说明 |
|--------|------|
| 用户体验 | 修复前封面和音频完全不可用；修复后公开 URL 直接可用 |
| 安全性 | `SUPABASE_SERVICE_ROLE_KEY` 是 secret key，仅限服务端使用，不可暴露到前端 |
| 兼容性 | 代码同时兼容公开 URL 和签名 URL，未来桶改为私有也不受影响 |

---

## 预防措施

### 短期

- [ ] 在 Vercel 配置 `SUPABASE_SERVICE_ROLE_KEY` 环境变量
- [ ] 验证 `/api/storage/sign` API 恢复正常

### 长期

- [ ] 在 CI/CD 流程中加入数据库迁移同步检查，确保代码依赖的 schema 变更已应用到生产
- [ ] 在 `.env.local.example` 中明确标注 `SUPABASE_SERVICE_ROLE_KEY` 是 API routes 必需的（不仅是 edge function）
- [ ] 考虑在 API 路由中增加环境变量缺失的友好报错，而非直接 500

---

## 相关文件

- `apps/web/src/components/sections/showcase-card.tsx`
- `packages/ui/src/components/audio-player/AudioPlayer.tsx`
- `packages/ui/src/components/audio-player/AudioEngine.tsx`
- `apps/web/src/app/api/storage/sign/route.ts`
- `packages/supabase/src/server.ts`
- `supabase-local/migrations/20260513000000_add_is_public_to_songs_albums.sql`
- `supabase-local/migrations/20260511190000_add_cover_file_path.sql`
