# Signed URL 存储安全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有音频和封面图片从永久公开 URL 迁移到 Signed URL（限时签名），并添加播放器自动续期机制。

**Architecture:** 数据库新增 `cover_file_path` 字段，所有生成端点改存 `file_path` 而非公开 URL；新建 `/api/storage/sign` 通用签名端点做权限校验；播放器 AudioEngine 内部管理 Signed URL 的获取与续期；前端图片组件按需签名。

**Tech Stack:** Next.js 14, Supabase Storage, Howler.js, Zustand, TypeScript, Vitest

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase-local/migrations/20260511190000_add_cover_file_path.sql` | Schema 变更：albums/songs 添加 `cover_file_path`，迁移现有 cover_url |
| `apps/web/src/app/api/storage/sign/route.ts` | 通用签名端点：权限校验 + `createSignedUrl` |
| `apps/web/src/app/api/storage/sign/route.test.ts` | sign 端点单元测试 |
| `apps/web/src/lib/storage.ts` | 客户端 sign 服务封装 |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | 修改：不再写入 `audio_url`，只写 `file_path` |
| `apps/web/src/app/api/songs/[id]/cover/route.ts` | 修改：upload  action 不再写入 `cover_url`，改存 `cover_file_path` |
| `apps/web/src/app/api/albums/[id]/cover/route.ts` | 修改：upload action 不再写入 `cover_url`，改存 `cover_file_path` |
| `apps/web/src/app/api/songs/cover/route.ts` | 修改：不再写入 `audio_url`，只写 `file_path` |
| `packages/ui/src/store/usePlayerStore.ts` | 修改：PlayerSong 添加 `file_path`，添加续期 timer 管理 |
| `packages/ui/src/components/audio-player/AudioEngine.tsx` | 修改：播放前 sign + 定时续期 + 播放事件兜底 |
| `apps/web/src/components/sections/showcase-card.tsx` | 修改：封面改用 sign API 获取临时 URL |
| `apps/web/src/components/sections/showcase.tsx` | 修改：查询添加 `cover_file_path` |
| `apps/web/src/app/[locale]/explore/page.tsx` | 修改：查询添加 `cover_file_path`，封面改用 sign |
| `apps/web/src/app/[locale]/albums/[id]/page.tsx` | 修改：专辑封面/音频改用 sign |
| `apps/web/src/app/[locale]/songs/[id]/page.tsx` | 修改：歌曲封面/音频改用 sign |
| `apps/web/src/app/[locale]/albums/page.tsx` | 修改：查询添加 `cover_file_path`，封面改用 sign |
| `apps/web/src/app/[locale]/songs/page.tsx` | 修改：查询添加 `cover_file_path`，封面改用 sign |
| `apps/web/src/app/[locale]/songs/cover/page.tsx` | 修改：用户上传后不再获取公开 URL，传给 API 的是 `file_path` |
| `apps/web/src/lib/test-utils.ts` | 修改：mock 补充 `cover_file_path` |

---

### Task 1: 数据库 Migration

**Files:**
- Create: `supabase-local/migrations/20260511190000_add_cover_file_path.sql`

- [ ] **Step 1: 编写 migration 文件**

```sql
-- Add cover_file_path to albums and songs
ALTER TABLE albums ADD COLUMN IF NOT EXISTS cover_file_path TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_file_path TEXT;

-- Migrate existing cover_url data to cover_file_path
-- For covers bucket URLs like: https://xxx/storage/v1/object/public/covers/albums/uuid/123.png
UPDATE albums
SET cover_file_path = regexp_replace(cover_url, '^https?://.*/object/public/covers/', '')
WHERE cover_url IS NOT NULL AND cover_file_path IS NULL;

UPDATE songs
SET cover_file_path = regexp_replace(cover_url, '^https?://.*/object/public/covers/', '')
WHERE cover_url IS NOT NULL AND cover_file_path IS NULL;
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase-local/migrations/20260511190000_add_cover_file_path.sql
git commit -m "feat(db): add cover_file_path columns to albums and songs"
```

---

### Task 2: 新建 `/api/storage/sign` 端点

**Files:**
- Create: `apps/web/src/app/api/storage/sign/route.ts`

- [ ] **Step 1: 编写 sign 端点**

```ts
import { createServerClient } from '@kiyo/supabase/server'
import { createServiceClient } from '@kiyo/supabase/service'
import { NextResponse } from 'next/server'

const VALID_BUCKETS = ['audio', 'covers'] as const

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: { bucket?: string; path?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { bucket, path } = body

  if (!bucket || !VALID_BUCKETS.includes(bucket as (typeof VALID_BUCKETS)[number])) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing bucket' } },
      { status: 400 }
    )
  }

  if (!path || typeof path !== 'string' || path.includes('..')) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid or missing path' } },
      { status: 400 }
    )
  }

  // Permission check
  let hasAccess = false

  if (bucket === 'audio') {
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('file_path', path)
      .single()

    if (song) {
      const isOwner = user?.id === song.user_id
      const isPublic = song.status === 'completed'
      hasAccess = isOwner || isPublic
    }
  } else if (bucket === 'covers') {
    // Check songs table first
    const { data: song } = await supabase
      .from('songs')
      .select('id, user_id, status')
      .eq('cover_file_path', path)
      .single()

    if (song) {
      const isOwner = user?.id === song.user_id
      const isPublic = song.status === 'completed'
      hasAccess = isOwner || isPublic
    } else {
      // Check albums table
      const { data: album } = await supabase
        .from('albums')
        .select('id, user_id')
        .eq('cover_file_path', path)
        .single()

      if (album) {
        hasAccess = user?.id === album.user_id
        // Albums are not public by default; extend here if needed
      }
    }
  }

  if (!hasAccess) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Access denied' } },
      { status: 403 }
    )
  }

  const serviceClient = createServiceClient()
  const { data: signedData, error: signedError } = await serviceClient
    .storage
    .from(bucket)
    .createSignedUrl(path, 3600)

  if (signedError || !signedData) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to generate signed URL' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    signedUrl: signedData.signedUrl,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/storage/sign/route.ts
git commit -m "feat(api): add /api/storage/sign endpoint for signed URLs"
```

---

### Task 3: `/api/storage/sign` 测试

**Files:**
- Create: `apps/web/src/app/api/storage/sign/route.test.ts`
- Modify: `apps/web/src/lib/test-utils.ts` (如需补充 mock)

- [ ] **Step 1: 编写测试**

```ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from './route'

describe('POST /api/storage/sign', () => {
  it('returns 400 for invalid bucket', async () => {
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'invalid', path: 'test.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for missing path', async () => {
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 403 for private song when not owner', async () => {
    // Requires test-utils mock setup with a song that has file_path 'user-2/private.mp3'
    // and current user is 'user-1'
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio', path: 'user-2/private.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('returns 200 with signedUrl for owner', async () => {
    const req = new Request('http://localhost/api/storage/sign', {
      method: 'POST',
      body: JSON.stringify({ bucket: 'audio', path: 'user-1/s1/123.mp3' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.signedUrl).toContain('sign/audio')
    expect(json.expiresAt).toBeDefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败（mock 未设置）**

```bash
pnpm --filter web test apps/web/src/app/api/storage/sign/route.test.ts
```

- [ ] **Step 3: 在 test-utils.ts 中补充必要 mock 数据**

在 `dataStore.songs` 中添加带有 `file_path` 和 `cover_file_path` 的测试歌曲，以及对应的 albums 数据。

- [ ] **Step 4: 再次运行测试**

```bash
pnpm --filter web test apps/web/src/app/api/storage/sign/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/storage/sign/route.test.ts apps/web/src/lib/test-utils.ts
git commit -m "test(api): add tests for /api/storage/sign endpoint"
```

---

### Task 4: 修改 AI 音乐生成端点

**Files:**
- Modify: `apps/web/src/app/api/songs/[id]/generate/route.ts`

- [ ] **Step 1: 将 update 中的 `audio_url` 替换为 `file_path`**

找到这段代码：
```ts
const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({
    audio_url: publicUrl.publicUrl,
    duration: result.duration,
    status: 'completed',
    source: 'ai_generated',
  })
```

替换为：
```ts
const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({
    file_path: filePath,
    audio_url: null,
    duration: result.duration,
    status: 'completed',
    source: 'ai_generated',
  })
```

- [ ] **Step 2: 运行相关测试**

```bash
pnpm --filter web test apps/web/src/app/api/songs/[id]/generate/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/[id]/generate/route.ts
git commit -m "feat(api): store file_path instead of public URL in song generation"
```

---

### Task 5: 修改歌曲封面上传端点

**Files:**
- Modify: `apps/web/src/app/api/songs/[id]/cover/route.ts`

- [ ] **Step 1: 修改 upload action 的数据库更新**

找到：
```ts
const { data: publicUrl } = supabase.storage.from('covers').getPublicUrl(filePath)

const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({ cover_url: publicUrl.publicUrl, cover_status: 'completed' })
```

替换为：
```ts
const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({ cover_file_path: filePath, cover_url: null, cover_status: 'completed' })
```

- [ ] **Step 2: 运行相关测试**

```bash
pnpm --filter web test apps/web/src/app/api/songs/[id]/cover/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/[id]/cover/route.ts
git commit -m "feat(api): store cover_file_path instead of cover_url in song cover upload"
```

---

### Task 6: 修改专辑封面上传端点

**Files:**
- Modify: `apps/web/src/app/api/albums/[id]/cover/route.ts`

- [ ] **Step 1: 修改 upload action 的数据库更新**

找到：
```ts
const { data: publicUrl } = supabase.storage.from('covers').getPublicUrl(filePath)

const { data: updatedAlbum, error: updateError } = await supabase
  .from('albums')
  .update({ cover_url: publicUrl.publicUrl, cover_status: 'completed' })
```

替换为：
```ts
const { data: updatedAlbum, error: updateError } = await supabase
  .from('albums')
  .update({ cover_file_path: filePath, cover_url: null, cover_status: 'completed' })
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/albums/[id]/cover/route.ts
git commit -m "feat(api): store cover_file_path instead of cover_url in album cover upload"
```

---

### Task 7: 修改翻唱歌曲生成端点

**Files:**
- Modify: `apps/web/src/app/api/songs/cover/route.ts`

- [ ] **Step 1: 修改 update 逻辑**

找到：
```ts
const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({
    audio_url: publicUrl.publicUrl,
    duration: result.duration,
    status: 'completed',
  })
```

替换为：
```ts
const { data: updatedSong, error: updateError } = await supabase
  .from('songs')
  .update({
    file_path: filePath,
    audio_url: null,
    duration: result.duration,
    status: 'completed',
  })
```

- [ ] **Step 2: 运行相关测试**

```bash
pnpm --filter web test apps/web/src/app/api/songs/cover/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/cover/route.ts
git commit -m "feat(api): store file_path instead of public URL in cover song generation"
```

---

### Task 8: 修改翻唱源音频上传页面

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/cover/page.tsx`

- [ ] **Step 1: 上传后存储 file_path 而非公开 URL**

找到 `handleFileUpload` 函数中：
```ts
const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
setUploadedUrl(publicUrl.publicUrl)
```

替换为：
```ts
setUploadedUrl(path) // Store path, API will resolve via file_path
```

同时修改 handleGenerate 中传给 API 的参数。由于 API (`/api/songs/cover`) 当前接收 `audio_url`（字符串 URL），但上传模式下这个值现在是 `path`（如 `audio-uploads/user-1/123-file.mp3`）。有两种选择：

**方案 A（简单）**：保持 API 不变，但如果是 path（不以 http 开头），API 内部把它当作 file_path 处理。这个端点本来就是创建新歌曲，服务端可以直接用这个 path 作为 file_path。

但当前 API 逻辑是 `fetch(result.audioUrl)` 下载外部音频。用户上传的音频已经在 storage 中了，不需要再下载。

实际上这个端点的 `audio_url` 参数有两个用途：
1. `existing` 模式：传现有歌曲的 audio_url（外部 URL 或公开 URL）
2. `upload` 模式：传用户上传后的公开 URL

对于 upload 模式，当前流程是：前端上传 → 获取公开 URL → 传给 API → API fetch 下载 → 重新上传到 storage → 存 file_path。

这很绕。更合理的做法是：upload 模式下，前端直接传 `file_path`，API 直接从 storage 读取，不用再下载上传。

但这改动较大。为了控制范围，先保持 API 流程不变，只改最后存储的字段。

所以 `handleFileUpload` 改为：
```ts
// 仍然获取公开 URL 传给 API（因为 API 需要 fetch 下载）
const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
setUploadedUrl(publicUrl.publicUrl)
```

但这样在 Task 7 中，API 已经不存 `audio_url` 了，而存 `file_path`。

等等，API 中的 `filePath` 是 `${user.id}/${song.id}/${Date.now()}.mp3`，不是前端上传的 path。所以 API 会重新上传到新的路径，存新的 file_path。前端的 uploadedUrl 只是作为源音频传给 API。所以 `handleFileUpload` 不需要改！

但等等，如果前端上传后获取公开 URL，而这个 bucket 已经没有 public URL 了（因为我们最终会移除 public access），那 `getPublicUrl` 还能用吗？

实际上 migration 中没有改 bucket 权限，只是改存储策略。而且 `getPublicUrl` 不需要 bucket 是 public 的，它只是一个 URL 构造器。只要 RLS 允许，这个 URL 就能访问。

但为了安全，应该让 API 直接从前端上传的 path 读取，而不是让前端再传一个公开 URL。

算了，这个问题太复杂。保持 `handleFileUpload` 不变（仍然获取 publicUrl），API 端点也保持下载流程，只是最后存 `file_path` 而非 `audio_url`。这是 Task 7 已经做的。

实际上再想想... `handleFileUpload` 的 `getPublicUrl` 是前端直接调的 Supabase client，不需要 server。这个 URL 确实存在安全风险，但这是上传临时文件作为 AI 翻唱的输入。如果 bucket 还有 public access，那确实有风险。

但为了控制范围，我们先不改前端上传流程。这已经是边缘 case（用户上传源音频），主要风险是已生成的歌曲和专辑封面。可以后续再迭代。

**所以 Task 8 实际上不需要改 `handleFileUpload`**。

那 Task 8 做什么？修改 `songs/cover/page.tsx` 中 `existing` 模式下查询歌曲列表时的字段。以及传给 API 的 `audio_url` 逻辑。

但实际上 existing 模式下，`audio_url` 是数据库里存的旧值（可能是公开 URL 或新数据的 file_path 为 null 但有 audio_url）。API 仍然接收 `audio_url`，然后 `fetch(audio_url)` 下载。如果 audio_url 是旧的公开 URL，仍然能下载；如果是新数据的 file_path，audio_url 为 null，existing 模式会失败。

这是一个兼容性问题。为了修复，existing 模式需要：
1. 查询时获取 `file_path` 
2. 传给 API 时需要传 signed URL 或公开 URL

但 API 端点在当前设计中没有改（仍然接收 `audio_url` 并 fetch）。如果 `file_path` 存在但没有 `audio_url`，API 无法 fetch。

所以 API 也需要改：如果前端传的是 `file_path`（而不是 URL），API 直接从 storage 读取。

这超出了当前 scope。为简化，先保持 `handleFileUpload` 和 API 的 `audio_url` 参数不变。`existing` 模式下，如果用户选择了一首只有 `file_path` 没有 `audio_url` 的歌曲，会失败（返回 400）。这在短期内是可接受的，因为翻唱功能主要是用旧数据（有 audio_url 的）。

不对，如果我们改了 generate 和 cover 端点，新歌就没有 audio_url 了，existing 模式会选不到这些歌。

那 `songs/cover/page.tsx` 的查询需要改：不再查 `audio_url IS NOT NULL`，而是查 `file_path IS NOT NULL OR audio_url IS NOT NULL`。传给 API 时优先用 `file_path` 生成 signed URL。

但这又需要改 API...

好吧，为了最小改动，我们这样处理 `songs/cover/page.tsx`：
1. 查询条件改为 `.not('file_path', 'is', null)`（新数据）
2. 但保留兼容：如果选了旧数据（只有 audio_url），传给 API 的仍然是 audio_url
3. 如果选了新数据（有 file_path），需要先生成 signed URL 再传给 API

但这需要前端生成 signed URL，意味着前端需要调用 sign API。

让我简化：修改 `songs/cover/page.tsx`，查询包含 `file_path`，传给 API 时：
- 如果有 `file_path`，先调 `/api/storage/sign` 获取 signedUrl，再传给 API 作为 `audio_url`
- 如果只有 `audio_url`，直接传

这样 API 端点不需要改！

好的，Task 8 就是做这个修改。

- [ ] **Step 1: 修改查询字段和条件**

```ts
const [songs, setSongs] = React.useState<{ id: string; title: string; audio_url: string | null; file_path: string | null }[]>([])

// 在 useEffect 中
supabase
  .from('songs')
  .select('id, title, audio_url, file_path')
  .eq('user_id', user.id)
  .or('audio_url.not.is.null,file_path.not.is.null')
  .order('created_at', { ascending: false })
```

- [ ] **Step 2: 修改 handleGenerate 中的 audioUrl 获取逻辑**

在 `handleGenerate` 中，找到：
```ts
const audioUrl = sourceMode === 'existing'
  ? songs.find((s) => s.id === selectedSongId)?.audio_url || ''
  : uploadedUrl
```

替换为：
```ts
let audioUrl = ''
if (sourceMode === 'existing') {
  const song = songs.find((s) => s.id === selectedSongId)
  if (song?.file_path) {
    // Need signed URL for API to fetch
    const res = await fetch('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'audio', path: song.file_path }),
    })
    if (res.ok) {
      const { signedUrl } = await res.json()
      audioUrl = signedUrl
    }
  } else if (song?.audio_url) {
    audioUrl = song.audio_url
  }
} else {
  audioUrl = uploadedUrl
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/songs/cover/page.tsx
git commit -m "feat(ui): cover page queries file_path and signs URLs for API"
```

---

### Task 9: 播放器自动续期（核心）

**Files:**
- Create: `apps/web/src/lib/storage.ts`
- Modify: `packages/ui/src/store/usePlayerStore.ts`
- Modify: `packages/ui/src/components/audio-player/AudioEngine.tsx`

- [ ] **Step 1: 创建客户端 sign 服务**

`apps/web/src/lib/storage.ts`:
```ts
export async function getSignedUrl(
  bucket: 'audio' | 'covers',
  path: string
): Promise<{ signedUrl: string; expiresAt: string }> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to sign URL')
  }
  return res.json()
}
```

- [ ] **Step 2: PlayerSong 添加 file_path**

`packages/ui/src/store/usePlayerStore.ts`:

在 `export interface PlayerSong` 中添加：
```ts
export interface PlayerSong {
  id: string
  title: string
  audio_url: string
  cover_url?: string | null
  file_path?: string | null  // NEW: for re-signing
  duration?: number | null
  album?: string | null
}
```

- [ ] **Step 3: AudioEngine 添加 sign 和续期逻辑**

`packages/ui/src/components/audio-player/AudioEngine.tsx`:

首先导入 sign 服务：
```ts
import { getSignedUrl } from '../../../../apps/web/src/lib/storage'
```

不对，这是跨包的导入。`packages/ui` 不能直接导入 `apps/web`。

需要把 `getSignedUrl` 放到 `packages/ui` 或共享位置。或者直接在 AudioEngine 里内联 fetch。

更简单的做法：直接在 AudioEngine 里写 fetch。

在 AudioEngine 顶部添加 helper：
```ts
async function signAudioUrl(filePath: string): Promise<string> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'audio', path: filePath }),
  })
  if (!res.ok) throw new Error('Failed to sign audio URL')
  const data = await res.json()
  return data.signedUrl
}
```

然后在 `useEffect([currentTrack?.audio_url])` 中修改加载逻辑：

找到现有代码：
```ts
useEffect(() => {
  if (!currentTrack?.audio_url) {
    // ... cleanup
    return
  }

  howlRef.current?.unload()
  // ...

  const howl = new Howl({
    src: [currentTrack.audio_url],
    // ...
  })
```

替换为：
```ts
useEffect(() => {
  if (!currentTrack?.audio_url && !currentTrack?.file_path) {
    howlRef.current?.unload()
    howlRef.current = null
    analyserRef.current = null
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setAnalyserData(null)
    return
  }

  let cancelled = false
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  async function loadAndPlay() {
    let src = currentTrack!.audio_url

    // If file_path exists, get a fresh signed URL
    if (currentTrack!.file_path) {
      try {
        src = await signAudioUrl(currentTrack!.file_path)
      } catch (err) {
        console.error('Failed to sign audio URL:', err)
        return
      }
    }

    if (cancelled) return

    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)

    const howl = new Howl({
      src: [src],
      html5: true,
      volume,
      onload: () => {
        if (!cancelled) setDuration(howl.duration())
      },
      onend: () => {
        if (!cancelled) next()
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
      },
      onplay: () => {
        // Ensure URL is still valid on resume
        if (currentTrack!.file_path) {
          scheduleRefresh(currentTrack!.file_path)
        }
      },
    })

    howlRef.current = howl

    if (isPlaying && !cancelled) {
      howl.play()
      startProgressLoop()
      startVisualizer()
    }

    // Schedule refresh before expiry (55 minutes, or sooner)
    if (currentTrack!.file_path) {
      refreshTimer = setTimeout(() => {
        if (!cancelled && howlRef.current?.playing()) {
          // Refresh in background; next track switch will use new URL
          signAudioUrl(currentTrack!.file_path!).catch(() => {})
        }
      }, 55 * 60 * 1000)
    }
  }

  loadAndPlay()

  return () => {
    cancelled = true
    if (refreshTimer) clearTimeout(refreshTimer)
    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
  }
}, [currentTrack?.audio_url, currentTrack?.file_path])
```

注意：由于 `currentTrack` 是一个 ref-stable 的 zustand selector，需要确保 effect 依赖正确。上面的代码使用了 `currentTrack?.audio_url` 和 `currentTrack?.file_path` 作为依赖，但 effect 内部还用了 `currentTrack` 对象。在 zustand 中 `currentTrack` 每次状态变化都是新引用，所以依赖应该没问题。

但实际上，当 URL 刷新时我们不希望重新创建 Howl。所以定时器只静默刷新 URL，不触发重渲染。

让我重新设计续期策略：

在 store 中存一个 `signedAudioUrl: string`，由 AudioEngine 在需要时更新。但 AudioEngine 不能调用 setState 因为它不是 hook...

等等，AudioEngine 是 React 组件，它可以调用 usePlayerStore 的 selector 和 action。如果我们在 store 上添加一个 `setSignedAudioUrl` action，AudioEngine 可以在获取到新 URL 后调用它。

但这会导致重渲染。不过只在 URL 变化时发生，频率很低（1 小时一次），可以接受。

更简单的方案：不用 store，AudioEngine 内部用 ref 存 signedUrl，当需要续期时直接更新 Howl 的 src。但 Howler 不支持运行时更换 src，需要 unload + recreate。

所以对于连续播放 1 小时+的情况，确实需要 unload + recreate Howl。但这会中断播放。

更好的方案：在还有 5 分钟过期时，如果正在播放，静默获取新 URL，但等当前播放结束或用户手动操作时再切换。

但 Howler 的 src 不能热切换。所以如果 URL 在播放中途过期，音频会停止。

实际上 Supabase Signed URL 过期后，已建立的 HTTP 连接不会中断。Howler 使用 HTML5 Audio 或 Web Audio，如果音频已经加载并开始流式播放，URL 过期不会影响当前播放。只有重新加载（seek、切换歌曲、页面刷新）时才需要新 URL。

所以实际情况是：
1. 播放开始时获取 signed URL
2. 暂停 30 分钟后恢复 → 可能需要新 URL（如果浏览器释放了资源）
3. 连续播放 1 小时+ → 流式传输不会中断，不需要续期
4. seek 操作 → 如果音频已缓冲，不需要重新请求；如果未缓冲，可能需要

对于 HTML5 Audio（Howler `html5: true`），音频是流式加载的。如果用户 seek 到一个未缓冲的位置，浏览器会发起新的 range request。如果这个 request 的 URL 已过期，会失败。

但这种情况比较少见。为了安全，我们可以在 `onseek` 或定时检查中刷新 URL。

不过最简单的做法还是：AudioEngine 在 `currentTrack` 变化时获取 signed URL，然后定期（比如每 50 分钟）刷新一次。如果刷新时正在播放，把新 URL 存到 ref 里，下次 `currentTrack` 不变但需要重新加载时使用。

由于 Howler 的 src 不能热切换，真正的"续期"只能在以下时机发生：
1. 播放开始时
2. 暂停后恢复播放时（onplay 事件）
3. 定时静默刷新（只存到 ref，不切换）

这样如果在播放中 seek 到了未缓冲区域且 URL 过期了，可能会失败。但这是可接受的边缘情况。

好了，让我简化设计：

1. `AudioEngine` 在 `currentTrack` 变化时，如果有 `file_path`，获取 signed URL 后播放
2. `AudioEngine` 添加一个 `signedUrlRef` 存当前的 signed URL
3. 每 50 分钟静默刷新 `signedUrlRef`
4. `onplay` 事件时，如果 `signedUrlRef` 已经过期（> 55 分钟），重新获取并重新创建 Howl

这样实现：

```ts
const signedUrlRef = useRef<string | null>(null)
const signedAtRef = useRef<number>(0)

async function ensureSignedUrl(filePath: string): Promise<string> {
  const now = Date.now()
  if (signedUrlRef.current && now - signedAtRef.current < 50 * 60 * 1000) {
    return signedUrlRef.current
  }
  const url = await signAudioUrl(filePath)
  signedUrlRef.current = url
  signedAtRef.current = now
  return url
}
```

然后在 `currentTrack` effect 中调用 `ensureSignedUrl`，在 `onplay` 中也调用（如果需要）。

好的，这个设计更清晰。让我重写 Step 3：

在 `AudioEngine` 组件内部（顶层，在 hooks 之前）添加：
```ts
async function signAudioUrl(filePath: string): Promise<string> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'audio', path: filePath }),
  })
  if (!res.ok) throw new Error('Failed to sign audio URL')
  const data = await res.json()
  return data.signedUrl
}
```

添加 ref：
```ts
const signedUrlRef = useRef<string | null>(null)
const signedAtRef = useRef<number>(0)
const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

async function ensureSignedUrl(filePath: string): Promise<string> {
  const now = Date.now()
  if (signedUrlRef.current && now - signedAtRef.current < 50 * 60 * 1000) {
    return signedUrlRef.current
  }
  const url = await signAudioUrl(filePath)
  signedUrlRef.current = url
  signedAtRef.current = now
  return url
}

function scheduleRefresh(filePath: string) {
  if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
  refreshTimerRef.current = setTimeout(async () => {
    try {
      await signAudioUrl(filePath)
      // signedUrlRef updated, but Howl continues with old URL
      // Next load/resume will use new URL
    } catch {
      // ignore background refresh failure
    }
  }, 50 * 60 * 1000)
}
```

修改 `currentTrack` effect：

```ts
useEffect(() => {
  if (!currentTrack?.audio_url && !currentTrack?.file_path) {
    howlRef.current?.unload()
    howlRef.current = null
    analyserRef.current = null
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setAnalyserData(null)
    signedUrlRef.current = null
    signedAtRef.current = 0
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    return
  }

  let cancelled = false

  async function initHowl() {
    let src = currentTrack!.audio_url

    if (currentTrack!.file_path) {
      try {
        src = await ensureSignedUrl(currentTrack!.file_path)
        scheduleRefresh(currentTrack!.file_path)
      } catch (err) {
        console.error('Failed to sign audio URL:', err)
        return
      }
    }

    if (cancelled) return

    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)

    const howl = new Howl({
      src: [src],
      html5: true,
      volume,
      onload: () => {
        if (!cancelled) setDuration(howl.duration())
      },
      onend: () => {
        if (!cancelled) next()
      },
      onplay: () => {
        // Refresh URL if stale when resuming
        if (currentTrack!.file_path) {
          const stale = Date.now() - signedAtRef.current > 55 * 60 * 1000
          if (stale) {
            ensureSignedUrl(currentTrack!.file_path).then((newUrl) => {
              if (howlRef.current === howl && newUrl !== src) {
                // URL changed, need to recreate Howl
                const wasPlaying = howl.playing()
                const currentSeek = howl.seek()
                howl.unload()
                const newHowl = new Howl({
                  src: [newUrl],
                  html5: true,
                  volume,
                  onload: () => {
                    newHowl.seek(currentSeek)
                    if (wasPlaying) newHowl.play()
                  },
                })
                howlRef.current = newHowl
              }
            }).catch(() => {})
          }
        }
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
      },
    })

    howlRef.current = howl

    if (isPlaying && !cancelled) {
      howl.play()
      startProgressLoop()
      startVisualizer()
    }
  }

  initHowl()

  return () => {
    cancelled = true
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
  }
}, [currentTrack?.audio_url, currentTrack?.file_path])
```

这个实现比较复杂，但覆盖了主要场景。为了简化，也可以不在 `onplay` 中做热切换，而是简单地：如果 URL 过期了，unload + recreate。这样会有短暂中断，但代码更简单。

让我选一个平衡的方案：不在 `onplay` 中做复杂的热切换，而是在 `currentTrack` effect 中根据 `file_path` 获取 signed URL，同时有一个定时器每 50 分钟刷新。如果用户在暂停很久后恢复播放，Howler 可能已经释放了资源，会自动重新加载，此时如果 URL 过期了，会在 `onloaderror` 中出错。

为了处理这种情况，可以在 `onloaderror` 中重试：

```ts
onloaderror: (_id, err) => {
  console.error('Howl load error:', err)
  if (currentTrack?.file_path) {
    // Retry with fresh signed URL
    signAudioUrl(currentTrack.file_path).then((newUrl) => {
      signedUrlRef.current = newUrl
      signedAtRef.current = Date.now()
      howlRef.current?.unload()
      const retryHowl = new Howl({
        src: [newUrl],
        html5: true,
        volume,
        onload: () => setDuration(retryHowl.duration()),
      })
      howlRef.current = retryHowl
      if (isPlaying) retryHowl.play()
    }).catch(() => {})
  }
},
```

但这会导致循环错误...

算了，让我采用最简单可靠的方案：

1. `currentTrack` 变化时获取 signed URL
2. 定时器每 50 分钟刷新 signed URL
3. `onplay` 时如果 URL 已过期（> 55 分钟），重新获取并重新创建 Howl（会短暂中断，但只在长暂停后发生）

让我把 Step 3 写得更简洁：

```ts
useEffect(() => {
  if (!currentTrack?.audio_url && !currentTrack?.file_path) {
    // cleanup...
    signedUrlRef.current = null
    signedAtRef.current = 0
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    return
  }

  let cancelled = false

  async function initHowl() {
    let src = currentTrack!.audio_url
    if (currentTrack!.file_path) {
      try {
        src = await ensureSignedUrl(currentTrack!.file_path)
      } catch (err) {
        console.error('Failed to sign audio URL:', err)
        return
      }
    }
    if (cancelled) return
    // ... create howl with src
  }

  initHowl()

  return () => {
    cancelled = true
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    howlRef.current?.unload()
    // ...
  }
}, [currentTrack?.audio_url, currentTrack?.file_path])
```

然后在 `onplay` 中：
```ts
onplay: () => {
  if (currentTrack?.file_path && Date.now() - signedAtRef.current > 55 * 60 * 1000) {
    ensureSignedUrl(currentTrack.file_path).then((url) => {
      if (howlRef.current && url !== howlRef.current._src[0]) {
        const pos = howlRef.current.seek()
        howlRef.current.unload()
        const newHowl = new Howl({
          src: [url],
          html5: true,
          volume,
          onload: () => {
            newHowl.seek(pos)
            newHowl.play()
          },
        })
        howlRef.current = newHowl
      }
    }).catch(() => {})
  }
},
```

好的，这就是最终方案。让我在计划中写出清晰的步骤。

实际上让我再次简化。Howler 的 `onplay` 会在每次调用 `play()` 时触发。当用户暂停后恢复，`play()` 被调用，`onplay` 触发。此时如果 URL 过期，我们重新获取并切换。

但有一个问题：在 `onplay` 中创建新的 Howl 并调用 `play()` 会导致递归调用 `onplay`！

所以需要加一个 flag 来防止递归：

```ts
const isRefreshingRef = useRef(false)

onplay: () => {
  if (isRefreshingRef.current) return
  if (currentTrack?.file_path && Date.now() - signedAtRef.current > 55 * 60 * 1000) {
    isRefreshingRef.current = true
    ensureSignedUrl(currentTrack.file_path).then((url) => {
      if (howlRef.current && url !== howlRef.current._src[0]) {
        const pos = howlRef.current.seek()
        howlRef.current.unload()
        const newHowl = new Howl({
          src: [url],
          html5: true,
          volume,
          onload: () => {
            newHowl.seek(pos)
            newHowl.play()
          },
          onplay: () => { isRefreshingRef.current = false },
        })
        howlRef.current = newHowl
      } else {
        isRefreshingRef.current = false
      }
    }).catch(() => { isRefreshingRef.current = false })
  }
},
```

这太复杂了，而且 `howlRef.current._src` 是内部属性，不保证稳定。

**最终决定采用极简方案**：

不在 `onplay` 中做热切换。只依赖：
1. `currentTrack` 变化时获取 fresh signed URL
2. 定时器每 50 分钟静默刷新 `signedUrlRef`
3. 如果用户暂停很久后恢复，Howler 会继续用已加载的音频（不需要 URL）。只有当音频被浏览器 GC 释放后才需要重新加载，此时如果 URL 过期了，会报错。这种情况很少见，且用户可以通过切歌再切回来刷新。

对于 long-running 播放（1 小时+），流式传输不会中断，因为音频已经加载到浏览器中了。

这个方案简单可靠。让我这样写计划。

不，还有一个问题：HTML5 Audio 在长时间播放后，如果网络不稳定或 seek 到未缓冲区域，可能需要重新请求。此时 URL 可能已过期。

但这是一个边缘情况，而且可以通过 `onloaderror` 简单处理：

```ts
onloaderror: (_id, err) => {
  console.error('Howl load error:', err)
  // If URL expired, user can retry by pausing and playing again
  // Or we could auto-retry once:
  if (currentTrack?.file_path && !isRefreshingRef.current) {
    isRefreshingRef.current = true
    signAudioUrl(currentTrack.file_path).then(url => {
      signedUrlRef.current = url
      signedAtRef.current = Date.now()
      // Don't auto-reload; let next user action trigger it
    }).finally(() => { isRefreshingRef.current = false })
  }
},
```

好的，就这么定了。计划中不做过度的续期逻辑，只做基本的时间检查 + 定时刷新 + 播放时检查。

最终简化版 Step 3：

在 AudioEngine 中添加：
```ts
const signedUrlRef = useRef<string>('')
const signedAtRef = useRef<number>(0)
const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

async function fetchSignedUrl(filePath: string): Promise<string> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'audio', path: filePath }),
  })
  if (!res.ok) throw new Error('Sign failed')
  const data = await res.json()
  return data.signedUrl
}
```

修改 `currentTrack` effect：
```ts
useEffect(() => {
  if (!currentTrack?.audio_url && !currentTrack?.file_path) {
    // cleanup
    signedUrlRef.current = ''
    signedAtRef.current = 0
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    return
  }

  let cancelled = false

  async function init() {
    let src = currentTrack!.audio_url
    if (currentTrack!.file_path) {
      try {
        src = await fetchSignedUrl(currentTrack!.file_path)
        signedUrlRef.current = src
        signedAtRef.current = Date.now()
        // Schedule background refresh at 50min
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = setTimeout(async () => {
          try {
            const url = await fetchSignedUrl(currentTrack!.file_path!)
            signedUrlRef.current = url
            signedAtRef.current = Date.now()
          } catch { /* ignore */ }
        }, 50 * 60 * 1000)
      } catch (err) {
        console.error('Sign failed:', err)
        return
      }
    }
    if (cancelled) return
    // create Howl with src
  }

  init()

  return () => {
    cancelled = true
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
  }
}, [currentTrack?.audio_url, currentTrack?.file_path])
```

然后在 `isPlaying` effect 中，恢复播放时检查：
```ts
useEffect(() => {
  const howl = howlRef.current
  if (!howl || !currentTrack) return

  if (isPlaying) {
    if (!howl.playing()) {
      // If URL may be stale and howl was unloaded, recreate
      if (currentTrack.file_path && Date.now() - signedAtRef.current > 55 * 60 * 1000) {
        fetchSignedUrl(currentTrack.file_path).then(url => {
          signedUrlRef.current = url
          signedAtRef.current = Date.now()
          howl.unload()
          const newHowl = new Howl({
            src: [url],
            html5: true,
            volume,
            onload: () => { setDuration(newHowl.duration()) },
          })
          howlRef.current = newHowl
          newHowl.play()
          startProgressLoop()
          startVisualizer()
        }).catch(() => {})
        return
      }
      howl.play()
      startProgressLoop()
      startVisualizer()
    }
  } else {
    if (howl.playing()) {
      howl.pause()
      stopProgressLoop()
      stopVisualizer()
    }
  }
}, [isPlaying])
```

这样，恢复播放时如果 URL 超过 55 分钟，会重新获取并重建 Howl。

但这个代码还是复杂。让我再想想...

实际上，`isPlaying` effect 只在 `isPlaying` 变化时触发。当 `currentTrack` 变化时，`isPlaying` effect 也会触发（因为 `currentTrack` 是依赖项）。

不，`isPlaying` effect 的依赖是 `[isPlaying]`，不包含 `currentTrack`。

让我看现有代码：
```ts
useEffect(() => {
  const howl = howlRef.current
  if (!howl || !currentTrack) return
  if (isPlaying) {
    if (!howl.playing()) { howl.play() ... }
  } else { ... }
}, [isPlaying])
```

这个 effect 在 `isPlaying` 变化时触发，但内部读取了 `currentTrack`（通过闭包）。这是安全的，因为 `currentTrack` 是 zustand 状态，通过闭包访问。

好的，让我在恢复播放时检查 URL 过期。这是合理的，因为只有恢复播放时才需要有效的 URL。

最终 Step 3 计划：

```ts
// In AudioEngine, add refs for signed URL tracking
const signedUrlRef = useRef<string>('')
const signedAtRef = useRef<number>(0)
const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

async function fetchSignedUrl(filePath: string): Promise<string> {
  const res = await fetch('/api/storage/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket: 'audio', path: filePath }),
  })
  if (!res.ok) throw new Error('Sign failed')
  const data = await res.json()
  return data.signedUrl
}
```

修改 `currentTrack` effect：
```ts
useEffect(() => {
  if (!currentTrack?.audio_url && !currentTrack?.file_path) {
    howlRef.current?.unload()
    howlRef.current = null
    analyserRef.current = null
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
    cancelAnimationFrame(rafRef.current)
    setAnalyserData(null)
    signedUrlRef.current = ''
    signedAtRef.current = 0
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    return
  }

  let cancelled = false

  async function initHowl() {
    let src = currentTrack!.audio_url

    if (currentTrack!.file_path) {
      try {
        src = await fetchSignedUrl(currentTrack!.file_path)
        signedUrlRef.current = src
        signedAtRef.current = Date.now()

        // Background refresh every 50 minutes
        refreshTimerRef.current = setTimeout(async () => {
          try {
            const url = await fetchSignedUrl(currentTrack!.file_path!)
            signedUrlRef.current = url
            signedAtRef.current = Date.now()
          } catch { /* ignore background failure */ }
        }, 50 * 60 * 1000)
      } catch (err) {
        console.error('Failed to sign audio URL:', err)
        return
      }
    }

    if (cancelled) return

    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)

    const howl = new Howl({
      src: [src],
      html5: true,
      volume,
      onload: () => {
        if (!cancelled) setDuration(howl.duration())
      },
      onend: () => {
        if (!cancelled) next()
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
      },
    })

    howlRef.current = howl

    if (isPlaying && !cancelled) {
      howl.play()
      startProgressLoop()
      startVisualizer()
    }
  }

  initHowl()

  return () => {
    cancelled = true
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    howlRef.current?.unload()
    cancelAnimationFrame(rafRef.current)
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
    }
  }
}, [currentTrack?.audio_url, currentTrack?.file_path])
```

修改 `isPlaying` effect，在恢复播放时检查过期：
```ts
useEffect(() => {
  const howl = howlRef.current
  if (!howl || !currentTrack) return

  if (isPlaying) {
    if (!howl.playing()) {
      // If file_path exists and URL is stale (>55min), refresh before playing
      if (
        currentTrack.file_path &&
        Date.now() - signedAtRef.current > 55 * 60 * 1000
      ) {
        fetchSignedUrl(currentTrack.file_path)
          .then((url) => {
            signedUrlRef.current = url
            signedAtRef.current = Date.now()
            howl.unload()
            const newHowl = new Howl({
              src: [url],
              html5: true,
              volume,
              onload: () => {
                setDuration(newHowl.duration())
                newHowl.play()
                startProgressLoop()
                startVisualizer()
              },
            })
            howlRef.current = newHowl
          })
          .catch((err) => {
            console.error('Failed to refresh signed URL on resume:', err)
          })
        return
      }

      howl.play()
      startProgressLoop()
      startVisualizer()
    }
  } else {
    if (howl.playing()) {
      howl.pause()
      stopProgressLoop()
      stopVisualizer()
    }
  }
}, [isPlaying])
```

等一下，这里有个问题：`isPlaying` effect 的依赖只有 `[isPlaying]`，但内部用了 `currentTrack`（通过闭包）。如果 `currentTrack` 变化时 `isPlaying` 没变，这个 effect 不会重新执行。但 `currentTrack` 变化时会触发另一个 effect（上面的那个），在那里会处理 URL 获取。

所以 `isPlaying` effect 只处理恢复播放的情况，这时 `currentTrack` 没有变化，只是 `isPlaying` 从 false 变为 true。此时如果 URL 过期，需要刷新。

但等等，如果用户在暂停期间 `currentTrack` 变了（比如切歌），那会触发 `currentTrack` effect，获取新的 URL。然后 `isPlaying` 变为 true（因为 play() 设置了 isPlaying = true），`isPlaying` effect 触发，此时 howl 已经在播放了（`currentTrack` effect 中设置的），所以 `!howl.playing()` 为 false，不会进入刷新逻辑。

这是正确的。

如果用户暂停后恢复（currentTrack 没变），`isPlaying` effect 触发，`!howl.playing()` 为 true，检查 URL 是否过期，如果过期则刷新。

这也是正确的。

好的，这个方案可行。

但还有一个问题：`currentTrack` effect 中依赖了 `isPlaying`。如果 `isPlaying` 在 `currentTrack` 没变的情况下变化（暂停/恢复），不会触发 `currentTrack` effect（因为它的依赖是 `[currentTrack?.audio_url, currentTrack?.file_path]`）。

这是正确的，因为暂停/恢复由 `isPlaying` effect 处理。

好的，方案确定。但还需要注意一个细节：`isPlaying` effect 内部调用了 `fetchSignedUrl`，这是一个 async 函数，而 `useEffect` 的 cleanup 函数需要能取消 pending 的 fetch。但 fetch 本身不能被取消（除非用 AbortController）。不过这里问题不大，因为结果只是更新 howl，不会导致严重问题。

现在还有一个问题：`startProgressLoop` 和 `startVisualizer` 在 `isPlaying` effect 内部调用，但它们引用了 `howlRef.current`。在 async fetch 的 then 回调中，我们设置了 `howlRef.current = newHowl`，然后调用 `startProgressLoop()`。但 `startProgressLoop` 使用的是 `howlRef.current`，所以应该没问题。

好了，方案确定。让我在计划中写清楚。

哦等等，还有 PlayerSong 的 `audio_url` 字段。当前前端传给 player 的 track 对象有 `audio_url`，这个值可能是旧的公开 URL 或新的 signed URL。

在我们的设计中：
- 如果 `file_path` 存在，AudioEngine 会忽略 `audio_url`，自己获取 signed URL
- 如果 `file_path` 不存在（旧数据），AudioEngine 用 `audio_url`

所以前端传给 player 的 track 对象不需要改（仍然传 `audio_url`），但需要额外传 `file_path`。这意味着前端查询时需要获取 `file_path`。

让我列出需要修改的前端查询：

1. `showcase.tsx` — 查询添加 `file_path`
2. `explore/page.tsx` — 查询添加 `file_path`
3. `albums/[id]/page.tsx` — 查询 songs 添加 `file_path`
4. `songs/[id]/page.tsx` — 查询添加 `file_path`
5. `albums/page.tsx` — 查询 albums 添加 `cover_file_path`
6. `songs/page.tsx` — 查询 songs 添加 `cover_file_path`

这些查询修改后，传给 player 的 track 对象就会有 `file_path`。

好的，现在让我写出完整的计划。

对于封面图片的 sign，我需要一个 hook 或工具函数。可以写一个 `useSignedImage(path: string | null, bucket: 'covers')` hook，但 hook 只能用于客户端组件。很多页面已经是 client component 了（因为用了 next-intl）。

或者更简单：直接在组件的 useEffect 中获取。

让我为封面图片写一个可复用的 hook：

```ts
// packages/ui/src/hooks/useSignedImage.ts
'use client'

import { useState, useEffect } from 'react'

export function useSignedImage(filePath: string | null, fallbackUrl?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(fallbackUrl || null)

  useEffect(() => {
    if (!filePath) {
      setUrl(fallbackUrl || null)
      return
    }

    let cancelled = false
    fetch('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'covers', path: filePath }),
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setUrl(data.signedUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(fallbackUrl || null)
      })

    return () => { cancelled = true }
  }, [filePath, fallbackUrl])

  return url
}
```

这个 hook 放在 `packages/ui` 中，所有需要显示封面图片的组件都可以用。

但等等，`packages/ui` 中不应该引用 `/api/storage/sign`，因为这不是它的 API。但从技术上说，fetch('/api/storage/sign') 是相对路径，在浏览器中会自动解析为当前 host + /api/storage/sign，所以没问题。

好的，现在写完整的计划。

实际上有一个更好的方案：对于封面图片，不需要 hook，因为图片的 `src` 可以直接在 Image 组件的 `src` 属性中使用。如果图片在 SSR/SSG 时就已经确定，那可以直接传给 Image。但 signed URL 是动态的...

对于 Next.js Image 组件，如果 `src` 是外部 URL（不是本地 public 文件），需要配置 `next.config.js` 中的 `remotePatterns`。Signed URL 的域名和 public URL 是一样的，所以应该已经在配置中了。

但问题是：如果 `src` 在组件 mount 后才获取，需要处理 loading 状态。

让我为封面图片写一个简单的组件或 hook。对于 album/song 列表页面，可以在 useEffect 中批量获取 signed URLs，避免每个图片都单独请求。

但为了简化，先用单个 hook，后续可以优化。

好了，让我完成计划文档。这会很长。