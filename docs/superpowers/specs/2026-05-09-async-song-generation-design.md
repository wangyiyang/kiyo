# AI 作曲异步队列化设计

> 对应 Issue: #48「AI 作曲同步请求超时，需改为异步队列」
> 关联 Issue: #49「音乐生成状态无轮询机制，用户需手动刷新」、#65「专辑封面生成也是同步请求」

---

## 1. 背景与问题

当前 `/api/songs/generate` 采用同步模式执行 AI 作曲：

```
用户请求 → 创建 song 记录 → 调用 Minimax API → 等待 30-120s → 下载音频 → 上传 Storage → 更新数据库 → 返回响应
```

整个流程在单个 HTTP 请求中完成。Minimax music-2.6 生成耗时通常为 30-120s，而：
- Vercel Hobby 函数超时限制：10s
- Vercel Pro 函数超时限制：60s

大量请求因超时而失败，用户体验极差。

### 1.1 关联问题

- **#49**：`status = generating` 时前端只显示静态文本，用户必须手动刷新才能知道是否完成
- **#65**：专辑封面生成也是同步请求，存在同样的超时风险

---

## 2. 设计目标

1. **消除超时**：将 AI 生成从 HTTP 同步请求中解耦，交由后端异步 worker 执行
2. **用户可追踪进度**：前端通过轮询实时获知生成状态
3. **失败可重试**：自动重试机制 + 用户手动重试入口
4. **可扩展**：同一套队列基础设施复用于封面生成（#65）
5. **最小侵入**：尽量复用现有数据库 schema 和前端组件，减少重构范围

---

## 3. 架构概览

### 3.1 数据流

```
┌─────────────┐     POST /api/songs/generate      ┌─────────────┐
│   用户前端   │ ─────────────────────────────────> │  Next.js API │
└─────────────┘                                    └─────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────┐
                                              │ 1. 创建 song 记录    │
                                              │    status=generating │
                                              │ 2. 创建 generation_  │
                                              │    task status=pending│
                                              │ 3. 返回 202 + task   │
                                              └────────────────────┘
                                                           │
                                                           ▼
┌─────────────┐     每 10s GET /api/songs/:id     ┌─────────────┐
│   用户前端   │ <───────────────────────────────── │  Next.js API │
│  (轮询状态)  │                                    └─────────────┘
└─────────────┘                                          ▲
     │                                                   │
     │  song.status=completed/failed                     │
     │  停止轮询，刷新 UI                                  │
     │                                                   │
     │              pg_cron 每分钟触发                    │
     │              POST Edge Function                    │
     └───────────────────────────────────────────────────┘
                                                           │
                                                           ▼
                                              ┌────────────────────┐
                                              │ Supabase Edge Func  │
                                              │ process-generation- │
                                              │ task                │
                                              │                     │
                                              │ 1. claim_pending_   │
                                              │    task()           │
                                              │ 2. 调用 Minimax API │
                                              │ 3. 下载 → 上传      │
                                              │ 4. 更新 task 状态   │
                                              │    → 触发器更新 song│
                                              └────────────────────┘
```

### 3.2 核心组件

| 组件 | 职责 | 技术栈 |
|------|------|--------|
| `POST /api/songs/generate` | 接收请求、创建 song + task、返回 202 | Next.js API Route |
| `generation_tasks` 表 | 任务队列，存储所有待处理/处理中/已完成/失败的生成任务 | PostgreSQL |
| `claim_pending_task()` | 原子性获取一条 pending 任务并标记为 processing | PL/pgSQL |
| `process-generation-task` | Edge Function，消费队列、执行 AI 生成 | Supabase Edge Function (Deno) |
| 数据库触发器 | task 状态变化时自动同步到 songs 表 | PostgreSQL Trigger |
| `pg_cron` | 每分钟调度 Edge Function | PostgreSQL 扩展 |
| `GenerationPanel` | Client Component，轮询 + 状态展示 + 重试按钮 | React + Next.js |
| `POST /api/tasks/retry` | 重置 failed 任务为 pending | Next.js API Route |

---

## 4. 数据库设计

### 4.1 generation_tasks 表

```sql
-- 任务队列表，管理所有异步 AI 生成任务
create table generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  -- 关联业务对象（根据任务类型 nullable）
  song_id uuid references songs(id) on delete cascade,
  album_id uuid references albums(id) on delete cascade,

  -- 任务类型
  type text not null,

  -- 执行状态
  status text not null default 'pending',

  -- 重试计数
  retry_count int not null default 0,
  max_retries int not null default 3,

  -- 错误信息
  error_message text,

  -- 任务输入参数（Minimax 调用参数）
  payload jsonb not null default '{}',

  -- 任务执行结果（audio_url, duration 等）
  result jsonb,

  -- 时间戳
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 检查约束
alter table generation_tasks
  add constraint generation_tasks_type_check
  check (type in ('music', 'cover', 'album_cover'));

alter table generation_tasks
  add constraint generation_tasks_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

-- 索引：快速查找待处理任务（Edge Function 消费用）
create index idx_generation_tasks_pending
  on generation_tasks (status, type, created_at)
  where status in ('pending', 'processing');

-- RLS
alter table generation_tasks enable row level security;

create policy "generation_tasks_user_all"
  on generation_tasks
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at 自动更新
create trigger update_generation_tasks_updated_at
  before update on generation_tasks
  for each row
  execute function moddatetime('updated_at');
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `type` | `music` = AI 作曲, `cover` = AI 翻唱, `album_cover` = 专辑封面生成 |
| `payload` | 任务输入参数，如 `{ prompt, genre, mood, mode, lyric_id, language }` |
| `result` | 任务输出，如 `{ audio_url, file_path, duration }` |
| `song_id` | music/cover 类型关联的歌曲 |
| `album_id` | album_cover 类型关联的专辑 |

### 4.2 claim_pending_task() 函数

原子性获取一条 pending 任务并标记为 processing，防止并发重复处理。

```sql
create or replace function claim_pending_task(task_type text)
returns generation_tasks as $$
declare
  claimed_task generation_tasks;
begin
  update generation_tasks
  set
    status = 'processing',
    started_at = now(),
    updated_at = now()
  where id = (
    select id
    from generation_tasks
    where status = 'pending'
      and type = task_type
    order by created_at
    for update skip locked
    limit 1
  )
  returning * into claimed_task;

  return claimed_task;
end;
$$ language plpgsql security definer;
```

**关键点：**
- `for update skip locked`：跳过已被其他事务锁定的行，防止并发争抢
- `security definer`：以函数创建者权限执行，绕过 RLS（Edge Function 使用 service role key 调用）
- 原子性：取任务 + 改状态在一个事务中完成

### 4.3 触发器：task → song 状态联动

当 `generation_tasks` 状态变化时，自动同步到 `songs` 表。

```sql
create or replace function handle_task_status_change()
returns trigger as $$
begin
  -- 任务完成：回填 songs 表
  if new.status = 'completed' and new.song_id is not null then
    update songs
    set
      status = 'completed',
      audio_url = (new.result->>'audio_url')::text,
      file_path = (new.result->>'file_path')::text,
      duration = (new.result->>'duration')::int,
      updated_at = now()
    where id = new.song_id;

  -- 任务失败：标记 song 为 failed
  elsif new.status = 'failed' and new.song_id is not null then
    update songs
    set
      status = 'failed',
      updated_at = now()
    where id = new.song_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger generation_tasks_status_change
  after update on generation_tasks
  for each row
  when (old.status is distinct from new.status)
  execute function handle_task_status_change();
```

**设计决策：**
- 触发器只在 `status` 字段变化时触发（`when` 子句），避免不必要的更新
- `song` 初始创建时 `status = generating`（由 API Route 设置），触发器只处理 `completed` 和 `failed` 的转换
- `result` 字段存储完整的输出，触发器从中提取字段回填 `songs`

---

## 5. API 层变更

### 5.1 POST /api/songs/generate（改造）

**核心变化：同步执行 → 异步创建任务**

```ts
// apps/web/src/app/api/songs/generate/route.ts

export async function POST(request: Request) {
  // ... 验证用户、参数（不变） ...

  // 1. 创建 song 记录
  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: prompt.trim().slice(0, 100),
      lyric_id: mode === 'existing_lyric' ? lyric_id : null,
      genre,
      mood,
      ai_prompt: fullPrompt,
      status: 'generating',        // ← 直接设为 generating
      source: 'ai_generated',
      user_id: user.id,
    })
    .select()
    .single()

  // 2. 创建 generation_tasks 记录
  const { data: task } = await supabase
    .from('generation_tasks')
    .insert({
      user_id: user.id,
      song_id: song.id,
      type: 'music',
      status: 'pending',
      max_retries: 3,
      payload: {
        prompt: fullPrompt,
        genre,
        mood,
        mode,
        lyric_id: mode === 'existing_lyric' ? lyric_id : null,
        language,
      },
    })
    .select()
    .single()

  // 3. 立即返回 202，不等待生成
  return NextResponse.json(
    { song, task },
    {
      status: 202,
      headers: { 'Retry-After': '10' },
    }
  )
}
```

**变更要点：**
- 删除原有的 `generateMusic()` + 下载 + 上传逻辑
- `songs.status` 直接设为 `'generating'`（原先是 `'draft'`，但 API 中会立刻调用生成后改为 `'generating'`）
- 返回 `202 Accepted`，header 中提示客户端 10s 后重试
- 响应体包含 `{ song, task }`，前端可立即跳转详情页

### 5.2 POST /api/tasks/retry（新增）

用户手动重试失败的生成任务。

```ts
// apps/web/src/app/api/tasks/retry/route.ts

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { song_id } = await request.json()
  if (!song_id) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 })

  // 1. 找到该 song 的 failed task
  const { data: task } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('song_id', song_id)
    .eq('user_id', user.id)
    .eq('status', 'failed')
    .single()

  if (!task) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

  // 2. 重置为 pending，清空错误，重置 retry_count
  const { data: updated } = await supabase
    .from('generation_tasks')
    .update({
      status: 'pending',
      retry_count: 0,
      error_message: null,
      result: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', task.id)
    .select()
    .single()

  // 3. 同步更新 songs 状态
  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', song_id)

  return NextResponse.json({ task: updated })
}
```

---

## 6. Edge Function: process-generation-task

### 6.1 部署位置

```
supabase-local/functions/process-generation-task/index.ts
```

### 6.2 环境变量

| 变量 | 来源 |
|------|------|
| `SUPABASE_URL` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key（绕过 RLS） |
| `MINIMAX_API_KEY` | Minimax API Key |

通过 `supabase secrets set` 部署到 Edge Function。

### 6.3 执行流程

```ts
// supabase-local/functions/process-generation-task/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. 原子性获取一条 pending 任务
  const { data: task, error: claimError } = await supabase
    .rpc('claim_pending_task', { task_type: 'music' })

  if (claimError || !task) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 })
  }

  try {
    // 2. 解析 payload
    const payload = task.payload as {
      prompt: string
      genre?: string
      mood?: string
      mode: string
      lyric_id?: string
      language?: string
    }

    // 3. 调用 Minimax API（直接使用 fetch，不依赖 @kiyo/ai）
    const minimaxBody: Record<string, unknown> = {
      model: 'music-2.6',
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
      prompt: payload.prompt,
    }

    if (payload.genre) minimaxBody.prompt += `，风格：${payload.genre}`
    if (payload.mood) minimaxBody.prompt += `，情绪：${payload.mood}`

    if (payload.mode === 'instrumental') {
      minimaxBody.is_instrumental = true
    } else if (payload.mode === 'auto_lyrics') {
      minimaxBody.lyrics_optimizer = true
    } else if (payload.mode === 'existing_lyric' && payload.lyric_id) {
      const { data: lyric } = await supabase
        .from('lyrics')
        .select('content')
        .eq('id', payload.lyric_id)
        .single()
      if (lyric?.content) minimaxBody.lyrics = lyric.content
    }

    const minimaxRes = await fetch('https://api.minimax.chat/v1/music_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('MINIMAX_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimaxBody),
    })

    if (!minimaxRes.ok) {
      throw new Error(`Minimax API error: ${minimaxRes.status}`)
    }

    const minimaxData = await minimaxRes.json()
    const audioUrl = minimaxData.data?.audio
    const durationMs = minimaxData.extra_info?.music_duration ?? 0
    const durationSeconds = Math.round(durationMs / 1000)

    if (!audioUrl) {
      throw new Error('Minimax response missing audio URL')
    }

    // 4. 下载音频
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error('Failed to download audio')
    const audioBuffer = await audioRes.arrayBuffer()

    // 5. 上传 Supabase Storage
    const filePath = `${task.user_id}/${task.song_id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    // 6. 获取 public URL
    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

    // 7. 标记任务完成
    await supabase
      .from('generation_tasks')
      .update({
        status: 'completed',
        result: {
          audio_url: publicUrl.publicUrl,
          file_path: filePath,
          duration: durationSeconds,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    return new Response(
      JSON.stringify({ processed: 1, task_id: task.id }),
      { status: 200 }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const retryCount = task.retry_count + 1

    if (retryCount >= task.max_retries) {
      // 最终失败
      await supabase
        .from('generation_tasks')
        .update({
          status: 'failed',
          retry_count: retryCount,
          error_message: message,
        })
        .eq('id', task.id)
    } else {
      // 重试：重置为 pending
      // 延迟策略：第1次立即，第2次30s后，第3次60s后
      const delaySeconds = retryCount === 1 ? 0 : retryCount === 2 ? 30 : 60
      const retryAt = new Date(Date.now() + delaySeconds * 1000)

      await supabase
        .from('generation_tasks')
        .update({
          status: 'pending',
          retry_count: retryCount,
          error_message: message,
          created_at: retryAt.toISOString(), // 通过修改 created_at 实现延迟
        })
        .eq('id', task.id)
    }

    return new Response(
      JSON.stringify({ processed: 0, error: message, task_id: task.id }),
      { status: 200 }
    )
  }
})
```

### 6.4 与 @kiyo/ai 的关系

Edge Function 运行在 Deno 运行时，无法直接 import Node.js monorepo 包 `@kiyo/ai`。因此：

- Edge Function 中**内联** Minimax API 调用逻辑（`fetch`）
- `@kiyo/ai` 中的 `music.ts` 仍保留，供其他同步调用场景使用（如歌词生成 `/api/lyrics/generate`，它不受超时影响）
- 长期可考虑将 `@kiyo/ai` 中与运行时无关的核心逻辑提取为纯函数，供 Edge Function 通过 esm.sh 引用

### 6.5 关键设计决策

| 决策 | 说明 |
|------|------|
| 每次处理 1 条任务 | 保持简单，避免单个 Edge Function 实例超时。`pg_cron` 每分钟触发一次，天然形成并发控制 |
| `SKIP LOCKED` | PostgreSQL 标准队列模式，支持多个并发 Edge Function 实例安全消费 |
| `created_at` 偏移实现延迟 | 重试时通过修改 `created_at` 让任务排到队列后面，无需额外字段 |
| 400s 执行时间 | Supabase Edge Function 限制 400s，足够覆盖 Minimax 的 30-120s 生成耗时 + 下载上传时间 |

---

## 7. 前端变更

### 7.1 歌曲生成页（`/songs/generate/page.tsx`）

**当前行为：** 点击生成 → 等待同步响应 → 成功后跳转详情页

**新行为：** 点击生成 → 立即收到 202 → 跳转到详情页（状态为 generating）

前端代码几乎不变，`res.ok` 在 202 时仍为 `true`：

```ts
const res = await fetch('/api/songs/generate', { ... })
const data = await res.json()
if (res.ok) {
  router.push(`/songs/${data.song.id}`) // 行为不变
}
```

### 7.2 歌曲详情页轮询组件（新增）

```tsx
// apps/web/src/app/songs/[id]/generation-panel.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@kiyo/ui'

interface GenerationPanelProps {
  songId: string
  initialStatus: string
}

export function GenerationPanel({ songId, initialStatus }: GenerationPanelProps) {
  const [status, setStatus] = useState(initialStatus)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/songs/${songId}`)
        if (!res.ok) return
        const data = await res.json()

        if (data.song.status !== status) {
          setStatus(data.song.status)
          if (data.song.status !== 'generating') {
            router.refresh() // 触发 Server Component 重渲染
          }
        }
      } catch {
        // 静默忽略轮询网络错误
      }
    }, 10000) // ← 10s 间隔

    return () => clearInterval(interval)
  }, [status, songId, router])

  const handleRetry = async () => {
    setErrorMsg('')
    const res = await fetch('/api/tasks/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_id: songId }),
    })
    if (res.ok) {
      setStatus('generating')
    } else {
      setErrorMsg('重试失败，请稍后重试')
    }
  }

  if (status === 'generating') {
    return (
      <div className="mb-6 rounded-lg border p-6 text-center">
        <div className="mb-2 inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">音乐生成中，请稍候...</p>
        <p className="mt-1 text-xs text-muted-foreground">这通常需要 30-120 秒</p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="mb-6 rounded-lg border border-destructive/50 p-6 text-center">
        <p className="mb-2 text-sm text-destructive">音乐生成失败</p>
        {errorMsg && <p className="mb-2 text-xs text-destructive">{errorMsg}</p>}
        <Button onClick={handleRetry} variant="outline">重新生成</Button>
      </div>
    )
  }

  return null
}
```

### 7.3 歌曲详情页改造

将 `apps/web/src/app/songs/[id]/page.tsx` 中 `generating` 和 `failed` 状态的展示区域替换为 `GenerationPanel`：

```tsx
// 在 page.tsx 中
import { GenerationPanel } from './generation-panel'

// 替换原有的 generating / failed 条件渲染：
<GenerationPanel songId={song.id} initialStatus={song.status} />

// 保留 completed 状态的 AudioPlayer 展示
```

**Server Component 不需要大改**，因为：
- 初始渲染时 `song.status` 由服务端提供
- `GenerationPanel` 作为 Client Component 负责动态状态更新
- `router.refresh()` 会在状态变化时触发整页数据重取

### 7.4 歌曲列表页

列表页不增加实时轮询（避免大量后台请求）。`SongCard` 的 `status` badge 在下次用户刷新列表时自然更新。

如果列表页有 `generating` 状态的歌曲，可以加一个轻量提示（如「有歌曲正在生成中，点击刷新查看最新状态」），但这属于体验优化，不在本次核心范围内。

---

## 8. 错误处理与重试策略

### 8.1 自动重试

| 重试次数 | 延迟 | 触发条件 |
|---------|------|---------|
| 0 → 1 | 立即 | Minimax API 返回错误、下载失败、上传失败 |
| 1 → 2 | 30s | 第 1 次重试仍然失败 |
| 2 → 3 | 60s | 第 2 次重试仍然失败 |
| 3+ | — | 标记为 `failed`，停止自动重试 |

**重试范围：**
- ✅ Minimax API 错误（5xx、超时、返回格式异常）
- ✅ 音频下载失败
- ✅ Storage 上传失败
- ❌ 用户取消（无取消机制，后续可扩展）

### 8.2 用户手动重试

- 详情页 `failed` 状态时显示「重新生成」按钮
- 调用 `POST /api/tasks/retry`，重置 `status = pending, retry_count = 0`
- 用户重试无次数限制（但可后续增加防滥用机制，配合 #66 Rate Limiting）

### 8.3 错误信息展示

- 自动重试期间的错误**不暴露给用户**（用户只看到「生成中」）
- 最终失败时，可展示最后一次错误信息（通过 `error_message` 字段）
- 生产环境中，详细错误信息应记录到日志（后续配合 #54 Sentry）

---

## 9. 调度机制

### 9.1 pg_cron 配置

```sql
-- 启用扩展（如未启用）
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 每分钟触发 Edge Function
select cron.schedule(
  'process-generation-tasks',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/process-generation-task',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <anon-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'
  ) as request_id;
  $$
);
```

**部署说明：**
- `project-ref` 和 `anon-key` 需替换为实际值
- `pg_net` 是 Supabase 内置扩展（部分项目需手动启用）
- 如果 `pg_net` 不可用，可使用外部 cron 服务（如 GitHub Actions、UptimeRobot）定期调用 Edge Function HTTP endpoint

### 9.2 调度策略说明

- **间隔 1 分钟**：`pg_cron` 的最小粒度。任务最大延迟为 1 分钟（任务创建后，下个整分钟才触发处理）
- **用户体验**：1 分钟延迟在 30-120s 的生成总耗时中可接受
- **并发控制**：`SKIP LOCKED` 允许多个 Edge Function 实例安全并行消费，但每个实例每次只处理 1 条任务
- **空队列优化**：Edge Function 在没有 pending 任务时立即返回（`processed: 0`），不占用资源

---

## 10. 测试策略

### 10.1 单元测试（Vitest）

| 模块 | 测试内容 |
|------|---------|
| `POST /api/songs/generate` | 返回 202、创建 song + task、validation 错误 |
| `POST /api/tasks/retry` | 重置 failed task、权限验证、找不到任务 |
| `GET /api/songs/:id` | 返回正确的 status 字段（已有测试，需确认覆盖） |

### 10.2 集成测试

| 场景 | 验证点 |
|------|--------|
| `claim_pending_task()` | 并发调用时不返回同一条任务 |
| 触发器联动 | task completed → song status/audio_url/duration 更新 |
| 触发器联动 | task failed → song status = failed |

### 10.3 E2E 测试（Playwright）

| 场景 | 步骤 |
|------|------|
| 完整生成流程 | 登录 → 创建生成任务 → 跳转到详情页 → 看到 generating 状态 → 等待完成 → 看到播放器 |
| 失败重试 | 模拟失败场景 → 看到失败提示 → 点击重试 → 恢复 generating → 最终完成 |

### 10.4 Edge Function 测试

- 本地通过 `supabase functions serve` 调试
- 测试 `claim_pending_task` RPC 调用
- 测试 Minimax API 错误场景的重试逻辑（可用 mock server）

---

## 11. 安全考量

| 风险 | 缓解措施 |
|------|---------|
| Edge Function 使用 Service Role Key | 通过 `supabase secrets set` 安全存储，不暴露在代码中 |
| `pg_cron` 调用 Edge Function 的鉴权 | Edge Function 可通过检查 `Authorization` header 中的 anon key 验证来源，或配置 Function-specific secret |
| `claim_pending_task` 的 `security definer` | 函数仅更新 `generation_tasks`，不操作其他表，权限范围可控 |
| 用户只能重试自己的任务 | `POST /api/tasks/retry` 通过 `user_id` 过滤 |
| `result` 字段不暴露敏感信息 | 只存储 audio_url/file_path/duration，不含 API key |
| RLS | `generation_tasks` 表 RLS 策略确保用户只能访问自己的任务 |

---

## 12. 影响范围与变更清单

### 12.1 新增文件

| 文件 | 说明 |
|------|------|
| `supabase-local/migrations/20260509_create_generation_tasks.sql` | 任务队列表 + 索引 + 约束 + RLS |
| `supabase-local/migrations/20260509_create_claim_pending_task.sql` | 原子取任务函数 |
| `supabase-local/migrations/20260509_create_task_status_trigger.sql` | task → song 触发器 |
| `supabase-local/migrations/20260509_add_pg_cron_schedule.sql` | pg_cron 定时任务（可选，视环境而定） |
| `supabase-local/functions/process-generation-task/index.ts` | Edge Function |
| `apps/web/src/app/api/tasks/retry/route.ts` | 重试 API |
| `apps/web/src/app/api/tasks/retry/route.test.ts` | 重试 API 测试 |
| `apps/web/src/app/songs/[id]/generation-panel.tsx` | 轮询 + 状态展示 Client Component |

### 12.2 修改文件

| 文件 | 变更 |
|------|------|
| `apps/web/src/app/api/songs/generate/route.ts` | 删除同步生成逻辑，改为创建 task + 返回 202 |
| `apps/web/src/app/api/songs/generate/route.test.ts` | 更新测试用例（期望 202，验证 task 创建） |
| `apps/web/src/app/songs/[id]/page.tsx` | 替换 generating/failed 区域为 `GenerationPanel` |
| `apps/web/src/app/songs/generate/page.tsx` | 确认无需修改（202 仍满足 `res.ok`） |
| `packages/supabase/src/database.types.ts` | 重新生成，包含 `generation_tasks` 类型 |

### 12.3 不修改的文件

| 文件 | 说明 |
|------|------|
| `packages/ai/src/music.ts` | 保留，供其他场景使用 |
| `apps/web/src/app/api/lyrics/generate/route.ts` | 歌词生成不受超时影响，保持同步 |
| `apps/web/src/app/songs/page.tsx` | 列表页不增加轮询 |

---

## 13. 后续扩展

### 13.1 Issue #65：专辑封面生成异步化

`generation_tasks` 表已预留 `album_cover` 类型：

```sql
-- 封面生成任务
insert into generation_tasks (type, album_id, payload)
values ('album_cover', 'album-uuid', { prompt: '...' })
```

Edge Function 中增加 `album_cover` 分支，调用图像生成 API，流程与 music 完全一致。

### 13.2 Issue #49 完整实现

当前设计已包含前端轮询机制。后续可升级为：
- **SSE**：Supabase Realtime 监听 `songs` 表 `status` 变化，减少轮询请求
- **WebSocket**：Supabase Realtime broadcast，推送状态变化到前端

### 13.3 监控与告警

- Edge Function 执行失败时记录到 Supabase Log Explorer
- 配合 #54 Sentry 捕获异常
- 队列堆积告警（pending 任务数超过阈值）

### 13.4 优先级队列

当前 FIFO 队列。后续可引入优先级：
- 付费用户任务优先
- 重试任务适当降权
- 通过 `priority` 字段 + `order by priority, created_at` 实现

---

## 14. 风险与回滚方案

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Edge Function 首次部署不熟悉 | 延迟 | 参考 Supabase 官方文档，先在本地 `supabase functions serve` 验证 |
| `pg_cron` / `pg_net` 未启用 | 调度失败 | 部署前确认扩展状态；备选方案：外部 cron 服务 |
| Minimax API 变更 | Edge Function 报错 | 保留现有 `@kiyo/ai` 作为参考，Edge Function 逻辑与现有 API 调用对齐 |
| 触发器性能问题 | 高并发时数据库压力 | 触发器只更新单行，影响极小；必要时可改为异步事件 |
| 前端轮询频率过高 | 服务器压力 | 已设定 10s 间隔，且只在 `generating` 状态时轮询 |

**回滚方案：**
1. 回滚数据库迁移（`supabase db reset` 到上一版本，或执行 down migration）
2. 恢复 `/api/songs/generate` 为同步模式（保留原代码注释或备份）
3. 移除 `pg_cron` 调度
4. 前端移除 `GenerationPanel`，恢复原有静态展示

---

*设计完成时间：2026-05-09*
*状态：待 review*
