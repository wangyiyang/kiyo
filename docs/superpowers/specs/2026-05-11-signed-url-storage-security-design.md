# Signed URL 存储安全设计

## Issue

- [wangyiyang/kiyo#72](https://github.com/wangyiyang/kiyo/issues/72)

## 问题

当前应用所有音频文件通过 Supabase Storage `getPublicUrl()` 获取**永久公开 URL**：

1. **URL 泄露 = 永久访问**：一旦 URL 被分享或泄露，任何人都能访问，无法撤销
2. **无法做访问控制**：无法限制「仅分享链接可访问」等场景
3. **与 bucket RLS 策略矛盾**：`audio` bucket 的 RLS 配置为「仅所有者可读」，但 public URL 绕过了 RLS

## 方案选型

采用**方案 B：数据库只存 `file_path`，客户端按需签名 + 自动续期**。

- `songs` 表的 `file_path` 已存在，说明这个方向已确定，只是生成端未跟进
- 生成端只有 3 处，改动面可控
- 播放器续期逻辑可封装在 `usePlayerStore` 里，对现有组件透明

## 数据库 Schema 变更 & 数据迁移

### Schema 变更（Migration）

```sql
-- albums 表
ALTER TABLE albums ADD COLUMN cover_file_path TEXT;

-- songs 表
ALTER TABLE songs ADD COLUMN cover_file_path TEXT;

-- songs.audio_url 和 albums.cover_url 保留（兼容），但不再由服务端写入新值
```

### 数据迁移

**audio（songs 表）**：
- 现有数据：大部分已有 `file_path`（从 `generate` 和 `cover` 端点解析得来），但生成端还在写 `audio_url`
- 缺失 `file_path` 的数据：通过解析 `audio_url` 反向提取 path 回填
- 本次改动后，**所有生成端不再写入 `audio_url`**

**cover（albums & songs 表）**：
- 新增 `cover_file_path` 字段
- 批量脚本：解析现有 `cover_url` 中的 path，写入 `cover_file_path`
- 例如：`https://xxx.co/storage/v1/object/public/covers/albums/uuid/123.png` → `albums/uuid/123.png`

### RLS 策略（不变）

- `audio` bucket RLS：仅所有者可读写（已配置）
- `covers` bucket RLS：类似配置
- Signed URL 由 service role 生成，不受 RLS 限制；但 sign API 会做应用层权限校验

## 服务端 API 设计

### 新建：`POST /api/storage/sign`

**请求体：**
```json
{
  "bucket": "audio" | "covers",
  "path": "user-1/s1/1234567890.mp3"
}
```

**权限校验逻辑：**

1. **解析资源归属**：
   - `audio/` → 查 `songs` 表 `file_path = path`
   - `covers/` → 查 `songs` 或 `albums` 表 `cover_file_path = path`

2. **校验规则**：
   - 当前用户是资源 owner → ✅
   - 资源是公开歌曲（`songs.status = 'completed'` 且 explore 可见）→ ✅
   - 否则 → 403

3. **生成签名**：
   ```ts
   const { data, error } = await serviceClient
     .storage
     .from(bucket)
     .createSignedUrl(path, 3600); // 1小时
   ```

4. **响应**：
   ```json
   {
     "signedUrl": "https://xxx.co/storage/v1/object/sign/audio/...",
     "expiresAt": "2026-05-11T12:00:00Z"
   }
   ```

### 修改现有生成端点

| 端点 | 当前行为 | 改为 |
|---|---|---|
| `POST /api/songs/[id]/generate` | `getPublicUrl('audio')` → 存 `audio_url` | 不再存 `audio_url`，只存 `file_path` |
| `POST /api/songs/[id]/cover` | `getPublicUrl('audio')` → 存 `audio_url` | 不再存 `audio_url`，只存 `file_path` |
| `POST /api/albums/[id]/cover` | `getPublicUrl('covers')` → 存 `cover_url` | 不再存 `cover_url`，改存 `cover_file_path` |
| `POST /api/songs/cover`（翻唱源上传）| `getPublicUrl('audio')` → 存 `audio_url` | 不再存 `audio_url`，只存 `file_path` |

### 修改现有查询端点

- `GET /api/songs/[id]/export`：已用 `file_path`，只需去掉 `audio_url` fallback 逻辑
- 所有前端直接读取 `audio_url` / `cover_url` 的地方 → 改为调 `/api/storage/sign` 获取临时 URL

## 客户端播放器自动续期

### 封装 Sign 服务

```ts
// lib/storage.ts
export async function getSignedUrl(
  bucket: 'audio' | 'covers',
  path: string
): Promise<{ signedUrl: string; expiresAt: number }> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  });
  if (!res.ok) throw new Error('Failed to sign URL');
  return res.json();
}
```

### 播放器续期逻辑（`usePlayerStore`）

在 `packages/ui/src/store/usePlayerStore.ts` 中扩展：

```ts
interface SignedAudioInfo {
  filePath: string;
  signedUrl: string;
  expiresAt: number; // timestamp ms
}

// 状态新增
signedAudio: SignedAudioInfo | null;
refreshTimer: NodeJS.Timeout | null;

// 动作
refreshAudioUrl: () => Promise<void>;
scheduleRefresh: () => void;
clearRefreshTimer: () => void;

// 实现要点
refreshAudioUrl: async () => {
  if (!currentTrack?.file_path) return;
  const { signedUrl, expiresAt } = await getSignedUrl('audio', currentTrack.file_path);
  set({ signedUrl, expiresAt: Date.parse(expiresAt) });
  // 更新 Howler src
  if (howl) {
    howl.unload();
    howl = new Howl({ src: [signedUrl], ... });
  }
},

scheduleRefresh: () => {
  const { expiresAt, clearRefreshTimer } = get();
  clearRefreshTimer();
  // 提前 5 分钟刷新，或每 10 分钟兜底
  const refreshIn = Math.min(expiresAt - Date.now() - 5 * 60 * 1000, 10 * 60 * 1000);
  const timer = setTimeout(() => get().refreshAudioUrl(), Math.max(refreshIn, 0));
  set({ refreshTimer: timer });
},

clearRefreshTimer: () => {
  if (get().refreshTimer) clearTimeout(get().refreshTimer);
},
```

### 播放事件兜底（AudioEngine）

在 `packages/ui/src/components/audio-player/AudioEngine.tsx` 中：

```ts
useEffect(() => {
  if (!currentTrack?.file_path) return;
  
  const ensureValidUrl = async () => {
    const { signedUrl, expiresAt } = get();
    if (!signedUrl || Date.now() > expiresAt - 60 * 1000) {
      // 已过期或 1 分钟内过期
      await refreshAudioUrl();
    }
  };
  
  // 播放/恢复时检查
  ensureValidUrl();
}, [currentTrack?.file_path]);

// Howler onplay / onresume 事件也触发 ensureValidUrl
```

### 图片加载（封面）

图片没有"暂停续期"问题，更简单：

```tsx
// 在需要显示封面的组件中
const [coverUrl, setCoverUrl] = useState<string | null>(null);

useEffect(() => {
  if (!album.cover_file_path) return;
  getSignedUrl('covers', album.cover_file_path).then(({ signedUrl }) => {
    setCoverUrl(signedUrl);
  });
}, [album.cover_file_path]);
```

可以封装成 `useSignedImage(album.cover_file_path)` hook。

## 测试策略

- `POST /api/storage/sign`：
  - owner 请求 → 200 + signedUrl
  - 非 owner 请求 private 资源 → 403
  - 匿名用户请求 public 资源 → 200
  - 匿名用户请求 private 资源 → 403
  - 无效 bucket → 400
  - 无效 path → 404

- 播放器续期：
  - 正常播放 → URL 不中断
  - 暂停 30 分钟后恢复 → 自动刷新 URL
  - 连续播放 1 小时+ → 定时刷新 URL

- 生成端点：
  - 生成后数据库 `audio_url` 为 null，`file_path` 有值
  - 封面生成后 `cover_url` 为 null，`cover_file_path` 有值

## 回滚策略

- `audio_url` 和 `cover_url` 字段保留，旧数据不动
- 若 Signed URL 方案出现问题，可快速切回 `getPublicUrl()` 逻辑
- 前端 `file_path` 字段不存在时可 fallback 到 `audio_url`（保留兼容代码）

## 影响范围

| 文件 | 改动类型 |
|---|---|
| `apps/web/src/app/api/storage/sign/route.ts` | 新增 |
| `apps/web/src/app/api/storage/sign/route.test.ts` | 新增 |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | 修改：不再写 `audio_url` |
| `apps/web/src/app/api/songs/[id]/cover/route.ts` | 修改：不再写 `audio_url` |
| `apps/web/src/app/api/albums/[id]/cover/route.ts` | 修改：不再写 `cover_url`，改存 `cover_file_path` |
| `apps/web/src/app/api/songs/cover/route.ts` | 修改：不再写 `audio_url` |
| `packages/ui/src/store/usePlayerStore.ts` | 修改：添加续期逻辑 |
| `packages/ui/src/components/audio-player/AudioEngine.tsx` | 修改：添加播放事件兜底 |
| `apps/web/src/lib/storage.ts` | 新增：sign 服务封装 |
| `apps/web/src/lib/test-utils.ts` | 修改：补充 mock |
| `supabase-local/migrations/...` | 新增：schema 变更 |
| `apps/web/src/components/sections/showcase-card.tsx` | 修改：封面改用 sign API |
| `apps/web/src/components/sections/showcase.tsx` | 修改：封面改用 sign API |
| `apps/web/src/app/[locale]/albums/[id]/page.tsx` | 修改：封面改用 sign API |
| `apps/web/src/app/[locale]/songs/[id]/page.tsx` | 修改：音频改用 sign API |
| `apps/web/src/app/[locale]/explore/page.tsx` | 修改：封面改用 sign API |
