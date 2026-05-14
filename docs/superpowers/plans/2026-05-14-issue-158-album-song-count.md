# Issue 158: 专辑列表歌曲数量与详情页不一致 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复专辑列表页歌曲数量显示为 0 的问题，使列表页与详情页数据一致。

**Architecture:** 在 `/api/albums` GET 查询中通过 Supabase 关联计数内嵌歌曲数量，前端列表页移除对不存在的独立 song-counts API 的调用，直接从专辑数据中读取 count。

**Tech Stack:** Next.js 14, TypeScript, Supabase, Tailwind CSS

---

### Task 1: 修改后端 API 内嵌歌曲数量

**Files:**
- Modify: `apps/web/src/app/api/albums/route.ts`

- [ ] **Step 1: 修改 GET 查询以嵌入 album_songs 计数**

将 Supabase 查询从 `.select('*')` 改为 `.select('*, album_songs(count)')`，使返回的专辑数据包含关联的 song count。

```ts
// 在 GET handler 中，找到这一行：
const { data: albums, error } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

// 替换为：
const { data: albums, error } = await supabase
    .from('albums')
    .select('*, album_songs(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/albums/route.ts
git commit -m "fix(api): embed album_songs count in albums list query (#158)"
```

---

### Task 2: 修改前端专辑列表页使用内嵌计数

**Files:**
- Modify: `apps/web/src/app/[locale]/albums/page.tsx`

- [ ] **Step 1: 更新 Album 接口添加 album_songs 字段**

在 `Album` interface 中增加 `album_songs` 可选字段：

```ts
interface Album {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  cover_file_path: string | null
  created_at: string
  album_songs?: { count: number }[]
}
```

- [ ] **Step 2: 移除 songCounts state 和独立 API 调用逻辑**

1. 删除 `songCounts` state 声明：

```ts
// 删除这一行：
const [songCounts, setSongCounts] = useState<Record<string, number>>({})
```

2. 在 `fetchAlbums` 函数中，删除整个 song-counts 的 POST 请求块（约 11 行），包括：

```ts
// 删除以下代码块：
// Fetch song counts for visible albums
if (fetchedAlbums.length > 0) {
  const albumIds = fetchedAlbums.map((a) => a.id)
  const countRes = await fetch('/api/albums/song-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ albumIds }),
  })
  if (countRes.ok) {
    const countData = await countRes.json()
    setSongCounts(countData.counts ?? {})
  }
} else {
  setSongCounts({})
}
```

3. 在 catch 块中删除 `setSongCounts({})`：

```ts
// 将 catch 块从：
catch {
  setAlbums([])
  setSongCounts({})
}

// 改为：
catch {
  setAlbums([])
}
```

4. 在 `fetchAlbums` 的依赖数组中移除对 `songCounts` 的依赖（当前依赖是 `[page]`，已经正确，无需修改）。

- [ ] **Step 3: 将 AlbumCard 的 songCount prop 改为从 album 数据读取**

在渲染 `AlbumCard` 的位置，将：

```tsx
<AlbumCard
  title={album.title}
  description={album.description}
  songCount={songCounts[album.id] ?? 0}
  coverUrl={album.cover_url}
  coverFilePath={album.cover_file_path}
/>
```

替换为：

```tsx
<AlbumCard
  title={album.title}
  description={album.description}
  songCount={album.album_songs?.[0]?.count ?? 0}
  coverUrl={album.cover_url}
  coverFilePath={album.cover_file_path}
/>
```

- [ ] **Step 4: 验证 TypeScript 编译通过**

```bash
pnpm --filter web type-check
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/albums/page.tsx
git commit -m "fix(albums): use embedded song count from albums list API (#158)"
```

---

### Task 3: 手动验证

- [ ] **Step 1: 启动本地开发服务器**

```bash
pnpm --filter web dev
```

- [ ] **Step 2: 验证修复**

1. 登录本地应用
2. 进入「专辑」列表页
3. 新建专辑并选择至少一首歌曲
4. 保存后返回列表页，确认卡片显示正确的歌曲数量（如 `1 首歌曲`）
5. 刷新页面，确认数量仍然正确
6. 点击进入专辑详情页，确认数量与列表一致

---

## Self-Review

**1. Spec coverage:**
- ✅ 后端 API 嵌入 count — Task 1
- ✅ 前端移除独立 API 调用，使用内嵌 count — Task 2
- ✅ 类型更新 — Task 2 Step 1
- ✅ 手动验证步骤 — Task 3

**2. Placeholder scan:**
- ✅ 无 TBD/TODO
- ✅ 所有代码变更均有具体的代码块
- ✅ 所有命令均有预期输出

**3. Type consistency:**
- ✅ `album_songs?: { count: number }[]` 与 Supabase 返回的嵌套计数结构一致
- ✅ `album.album_songs?.[0]?.count ?? 0` 与 AlbumCard 的 `songCount: number` prop 类型兼容
