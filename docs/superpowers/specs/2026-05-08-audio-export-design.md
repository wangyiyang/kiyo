# Issue #27: Audio Export (MP3) — Design Spec

## 背景

Issue #27 要求支持将歌曲导出为多种格式（WAV/MP3/MIDI）。经过与维护者讨论，**做减法**：只支持 **MP3** 一种格式，通过弹窗确认后触发下载。

## 目标

- 用户可从歌曲详情页导出已完成的歌曲为 MP3 文件
- 下载链接使用 Supabase Storage 签名链接（5 分钟过期）
- 下载文件名使用歌曲标题（如 `我的歌曲名.mp3`）
- 导出失败时有清晰的错误提示

## 约束

- **只支持 MP3**，零其他格式
- **一个弹窗 UI**，无下拉菜单
- **零修改 AI 生成核心逻辑**（只改存储路径写入）
- **支持旧数据兼容**（无 `file_path` 时 fallback 从 `audio_url` 解析）

---

## 架构

```
┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  歌曲详情页       │────▶│ GET /api/songs/  │────▶│ Supabase Storage│
│  「导出」按钮     │     │ :id/export       │     │ audio bucket    │
│  → 弹窗确认      │     │ 1. 校验归属      │     │ 生成签名链接    │
│  → 触发下载      │◄────│ 2. 生成签名 URL  │◄────│ (5min 过期)     │
└──────────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 数据库变更

### Migration

```sql
-- 新增 file_path 字段
alter table songs add column file_path text;
```

### 数据回填

```sql
-- 将现有 audio_url 转为 file_path
update songs
set file_path = regexp_replace(
  audio_url,
  '^https?://[^/]+/storage/v1/object/public/audio/',
  ''
)
where audio_url is not null and file_path is null;
```

### AI 生成时存储 file_path

修改 `apps/web/src/app/api/songs/generate/route.ts`，在 Storage upload 后，`update songs` 时同时写入 `file_path: filePath`。

---

## API 设计

### `GET /api/songs/:id/export`

**权限校验：**
- 401: 未登录
- 403: 非歌曲所有者
- 404: 歌曲不存在

**业务校验：**
- 400: `status !== 'completed'`
- 400: `file_path` 和 `audio_url` 均为空

**成功响应（200）：**
```json
{
  "downloadUrl": "https://xxx.supabase.co/storage/v1/object/sign/audio/uid/sid/xxx.mp3?token=xxx",
  "filename": "我的歌曲名.mp3",
  "expiresAt": "2026-05-08T07:15:00Z"
}
```

**签名链接生成：**
```ts
const filePath = song.file_path || parsePathFromUrl(song.audio_url)
const { data: signedUrl } = await supabase
  .storage.from('audio')
  .createSignedUrl(filePath, 300) // 5 分钟
```

---

## 前端设计

### 歌曲详情页按钮

在 `status === 'completed' && (song.file_path || song.audio_url)` 时展示「导出」按钮，位于 header 按钮组中。

### 导出弹窗

```
┌─────────────────────────────┐
│  导出音频                    │
├─────────────────────────────┤
│  歌曲：我的歌曲名            │
│  格式：MP3                   │
│                             │
│  [取消]        [确认导出]   │
└─────────────────────────────┘
```

**交互：**
1. 点击「导出」→ 打开 Dialog
2. 点击「确认导出」→ `fetch(/api/songs/:id/export)` → 拿到 `downloadUrl`
3. 创建隐藏 `<a>` 元素触发下载（`href=downloadUrl`, `download=filename`）
4. Dialog 关闭，toast("已开始下载")

### 组件结构

- `apps/web/src/app/songs/[id]/export-dialog.tsx` — Client Component
- `apps/web/src/app/songs/[id]/page.tsx` — 引入 ExportDialog

---

## 错误处理

| 场景 | 前端行为 |
|-----|---------|
| 未登录 | 跳转登录 |
| 无权操作 | toast("无权操作") |
| 歌曲不存在 | notFound() |
| 无可导出文件 | toast("无可导出文件") |
| 签名生成失败 | toast("导出失败，请稍后重试") |

---

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `supabase/migrations/20260508150001_add_songs_file_path.sql` | 创建 | 新增 file_path 字段 + 数据回填 |
| `apps/web/src/app/api/songs/generate/route.ts` | 修改 | 生成时同时写入 file_path |
| `apps/web/src/app/api/songs/[id]/export/route.ts` | 创建 | 导出签名链接 API |
| `apps/web/src/app/songs/[id]/export-dialog.tsx` | 创建 | 导出弹窗组件 |
| `apps/web/src/app/songs/[id]/page.tsx` | 修改 | 引入 ExportDialog 按钮 |

---

## 兼容性

- 旧歌曲无 `file_path` 时，fallback 从 `audio_url` 解析路径
- `audio_url` 字段继续保留，供 AudioPlayer 预览使用
- 未来可逐步淘汰 `audio_url`，统一使用签名链接
