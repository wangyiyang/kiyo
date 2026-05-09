# AI 作曲异步队列化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 作曲从同步请求改造为异步队列，消除 Vercel 超时问题，并为 Issue #65 提供可复用的队列基础设施。

**Architecture:** 新增 `generation_tasks` 表作为队列；Supabase Edge Function 消费队列并调用 Minimax API；前端通过轮询追踪状态；`pg_cron` 每分钟调度 Edge Function。

**Tech Stack:** Next.js 14 API Routes, Supabase Edge Functions (Deno), PostgreSQL + pg_cron, React Client Components, Vitest

---

## 文件结构总览

| 文件 | 操作 | 说明 |
|------|------|------|
| `supabase-local/migrations/20260509120001_create_generation_tasks.sql` | 创建 | 任务队列表、约束、索引、RLS |
| `supabase-local/migrations/20260509120002_create_claim_pending_task.sql` | 创建 | 原子取任务 PL/pgSQL 函数 |
| `supabase-local/migrations/20260509120003_create_task_status_trigger.sql` | 创建 | task → song 状态联动触发器 |
| `apps/web/src/lib/test-utils.ts` | 修改 | 扩展 mock client 支持 `generation_tasks` 和 `rpc` |
| `apps/web/src/app/api/songs/generate/route.ts` | 修改 | 同步 → 异步，返回 202 |
| `apps/web/src/app/api/songs/generate/route.test.ts` | 修改 | 更新为异步模式断言 |
| `apps/web/src/app/api/tasks/retry/route.ts` | 创建 | 手动重试 failed task |
| `apps/web/src/app/api/tasks/retry/route.test.ts` | 创建 | 重试 API 测试 |
| `supabase-local/functions/process-generation-task/index.ts` | 创建 | Edge Function：消费队列、调用 Minimax、上传 Storage |
| `supabase-local/functions/process-generation-task/.env` | 创建 | 本地 Edge Function 环境变量 |
| `apps/web/src/app/songs/[id]/generation-panel.tsx` | 创建 | Client Component：轮询 + 状态展示 + 重试按钮 |
| `apps/web/src/app/songs/[id]/page.tsx` | 修改 | 引入 GenerationPanel，替换 generating/failed 静态区域 |
| `packages/supabase/src/database.types.ts` | 修改 | 重新生成，包含 `generation_tasks` 类型 |
| `.env.local.example` | 修改 | 添加 Edge Function 所需环境变量注释 |

---

### Task 1: 创建 generation_tasks 表迁移

**Files:**
- Create: `supabase-local/migrations/20260509120001_create_generation_tasks.sql`

- [ ] **Step 1: 写迁移文件**

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

- [ ] **Step 2: 应用迁移**

Run: `pnpm supabase:db:reset`

Expected: 迁移成功应用，无报错。输出包含 `Applied supabase-local/migrations/20260509120001_create_generation_tasks.sql`

- [ ] **Step 3: 验证表结构**

Run:
```bash
docker exec -i supabase_db_cgqorvwsnuiqtoxzwymr psql -U postgres -d postgres -c "
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'generation_tasks'
ORDER BY ordinal_position;
"
```

Expected: 列出 `id`, `user_id`, `song_id`, `album_id`, `type`, `status`, `retry_count`, `max_retries`, `error_message`, `payload`, `result`, `started_at`, `completed_at`, `created_at`, `updated_at`

- [ ] **Step 4: Commit**

```bash
git add supabase-local/migrations/20260509120001_create_generation_tasks.sql
git commit -m "feat(db): create generation_tasks queue table"
```

---

### Task 2: 创建 claim_pending_task() 函数迁移

**Files:**
- Create: `supabase-local/migrations/20260509120002_create_claim_pending_task.sql`

- [ ] **Step 1: 写迁移文件**

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

- [ ] **Step 2: 应用迁移**

Run: `pnpm supabase:db:reset`

Expected: 迁移成功应用，输出包含 `Applied supabase-local/migrations/20260509120002_create_claim_pending_task.sql`

- [ ] **Step 3: 验证函数**

Run:
```bash
docker exec -i supabase_db_cgqorvwsnuiqtoxzwymr psql -U postgres -d postgres -c "
SELECT proname, prosrc LIKE '%skip locked%' as has_skip_locked
FROM pg_proc
WHERE proname = 'claim_pending_task';
"
```

Expected: 返回一行，`proname = claim_pending_task`, `has_skip_locked = true`

- [ ] **Step 4: Commit**

```bash
git add supabase-local/migrations/20260509120002_create_claim_pending_task.sql
git commit -m "feat(db): add claim_pending_task function with SKIP LOCKED"
```

---

### Task 3: 创建 task → song 触发器迁移

**Files:**
- Create: `supabase-local/migrations/20260509120003_create_task_status_trigger.sql`

- [ ] **Step 1: 写迁移文件**

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

- [ ] **Step 2: 应用迁移**

Run: `pnpm supabase:db:reset`

Expected: 迁移成功应用，输出包含 `Applied supabase-local/migrations/20260509120003_create_task_status_trigger.sql`

- [ ] **Step 3: 验证触发器**

Run:
```bash
docker exec -i supabase_db_cgqorvwsnuiqtoxzwymr psql -U postgres -d postgres -c "
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'generation_tasks_status_change';
"
```

Expected: 返回一行，`tgname = generation_tasks_status_change`, `tgenabled = O`

- [ ] **Step 4: Commit**

```bash
git add supabase-local/migrations/20260509120003_create_task_status_trigger.sql
git commit -m "feat(db): add trigger to sync task status to songs"
```

---

### Task 4: 扩展测试工具支持 generation_tasks

**Files:**
- Modify: `apps/web/src/lib/test-utils.ts`

- [ ] **Step 1: 在 dataStore 中增加 generation_tasks**

修改 `createMockSupabaseClient` 函数内的 `dataStore` 初始化：

```ts
const dataStore: Record<string, any[]> = {
  songs: [],
  albums: [],
  album_songs: [],
  lyrics: [],
  generation_tasks: [],
}
```

在 `apps/web/src/lib/test-utils.ts` 中搜索并替换上述代码块。

- [ ] **Step 2: 增加 rpc 方法支持**

在 `createMockSupabaseClient` 返回对象中增加 `rpc` 方法。找到 `return { from, auth, dataStore, chain, storage, uploadedFiles }` 这一行，替换为：

```ts
  const rpc = (fn: string, params?: Record<string, unknown>) => {
    if (fn === 'claim_pending_task') {
      const type = params?.task_type as string
      const pending = dataStore.generation_tasks
        .filter((t) => t.status === 'pending' && t.type === type)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const task = pending[0] ?? null
      if (task) {
        task.status = 'processing'
        task.started_at = new Date().toISOString()
      }
      return Promise.resolve({ data: task, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  }

  return { from, auth, dataStore, chain, storage, uploadedFiles, rpc }
```

- [ ] **Step 3: 运行现有测试确认未破坏**

Run: `pnpm --filter web test -- --run src/app/api/songs/generate/route.test.ts`

Expected: 测试通过（此时 generate 路由还未修改，只是 mock 增加了新能力）

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/test-utils.ts
git commit -m "test: extend mock client to support generation_tasks and rpc"
```

---

### Task 5: 改造 POST /api/songs/generate 为异步模式

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`

- [ ] **Step 1: 修改 route.ts，删除同步生成逻辑**

完整替换文件内容：

```ts
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

const VALID_MODES = ['instrumental', 'auto_lyrics', 'existing_lyric'] as const
type Mode = (typeof VALID_MODES)[number]

const LANGUAGE_MAP: Record<string, string> = {
  zh: '中文',
  en: '英文',
  ja: '日文',
}

function buildPrompt(prompt: string, language?: string, genre?: string, mood?: string): string {
  const parts: string[] = []
  if (language && LANGUAGE_MAP[language]) {
    parts.push(LANGUAGE_MAP[language])
  }
  parts.push(prompt)
  if (genre) parts.push(`风格：${genre}`)
  if (mood) parts.push(`情绪：${mood}`)
  return parts.join('，')
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { prompt, mode, genre, mood, language, lyric_id } = body

  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } },
      { status: 400 }
    )
  }

  if (!VALID_MODES.includes(mode as Mode)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid mode' } },
      { status: 400 }
    )
  }

  if (mode === 'existing_lyric') {
    if (!lyric_id || typeof lyric_id !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'lyric_id is required for existing_lyric mode' } },
        { status: 400 }
      )
    }

    const { data: lyric, error: lyricError } = await supabase
      .from('lyrics')
      .select('id, user_id, content')
      .eq('id', lyric_id)
      .single()

    if (lyricError || !lyric) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
        { status: 404 }
      )
    }

    if (lyric.user_id !== user.id) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'You do not have permission to use this lyric' } },
        { status: 403 }
      )
    }
  }

  const fullPrompt = buildPrompt(
    prompt.trim(),
    typeof language === 'string' ? language : undefined,
    typeof genre === 'string' ? genre : undefined,
    typeof mood === 'string' ? mood : undefined
  )

  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: prompt.trim().slice(0, 100),
      lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
      genre: typeof genre === 'string' ? genre : null,
      mood: typeof mood === 'string' ? mood : null,
      ai_prompt: fullPrompt,
      status: 'generating',
      source: 'ai_generated',
      user_id: user.id,
    })
    .select()
    .single()

  if (insertError || !song) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: insertError?.message ?? 'Failed to create song' } },
      { status: 500 }
    )
  }

  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .insert({
      user_id: user.id,
      song_id: song.id,
      type: 'music',
      status: 'pending',
      max_retries: 3,
      payload: {
        prompt: fullPrompt,
        genre: typeof genre === 'string' ? genre : null,
        mood: typeof mood === 'string' ? mood : null,
        mode,
        lyric_id: mode === 'existing_lyric' && typeof lyric_id === 'string' ? lyric_id : null,
        language: typeof language === 'string' ? language : null,
      },
    })
    .select()
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: taskError?.message ?? 'Failed to create generation task' } },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { song, task },
    {
      status: 202,
      headers: { 'Retry-After': '10' },
    }
  )
}
```

- [ ] **Step 2: 运行测试（应失败，因为测试期望旧的同步行为）**

Run: `pnpm --filter web test -- --run src/app/api/songs/generate/route.test.ts`

Expected: 多个测试失败。例如 `auto_lyrics mode success` 断言 `expect(json.song.status).toBe('completed')` 但实际为 `'generating'`

- [ ] **Step 3: 更新测试**

完整替换 `apps/web/src/app/api/songs/generate/route.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/songs/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/songs/generate (async)', () => {
  it('auto_lyrics mode returns 202 and creates song + task', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A happy pop song',
      mode: 'auto_lyrics',
      genre: 'pop',
      mood: 'happy',
      language: 'en',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.song.status).toBe('generating')
    expect(json.song.source).toBe('ai_generated')
    expect(json.task.status).toBe('pending')
    expect(json.task.type).toBe('music')
    expect(json.task.payload.mode).toBe('auto_lyrics')
    expect(json.task.payload.prompt).toContain('英文')

    const task = mockClient.dataStore.generation_tasks[0]
    expect(task).toBeDefined()
    expect(task.user_id).toBe('user-1')
    expect(task.song_id).toBe(json.song.id)
  })

  it('instrumental mode returns 202', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'Epic orchestral background',
      mode: 'instrumental',
      genre: 'orchestral',
      language: 'zh',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.song.status).toBe('generating')
    expect(json.task.payload.mode).toBe('instrumental')
    expect(json.task.payload.isInstrumental).toBeUndefined()
  })

  it('existing_lyric mode returns 202', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A rock ballad',
      mode: 'existing_lyric',
      lyric_id: 'l1',
      genre: 'rock',
      language: 'ja',
    }))

    expect(response.status).toBe(202)
    const json = await response.json()
    expect(json.task.payload.lyric_id).toBe('l1')
  })

  it('invalid mode returns 400', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'invalid_mode',
    }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('existing_lyric missing lyric_id returns 400', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'existing_lyric',
    }))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('lyric owned by another user returns 403', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-2', content: 'Secret lyrics' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'existing_lyric',
      lyric_id: 'l1',
    }))

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('unauthenticated returns 401', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'test',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 500 if task creation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })

    const originalInsert = mockClient.from('generation_tasks').insert
    mockClient.from = (table: string) => {
      const chain = originalInsert.bind(mockClient)
      if (table === 'generation_tasks') {
        return {
          ...chain,
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }
      }
      return chain(table)
    }

    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({
      prompt: 'A song',
      mode: 'auto_lyrics',
    }))

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web test -- --run src/app/api/songs/generate/route.test.ts`

Expected: 所有 8 个测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/generate/route.ts
git add apps/web/src/app/api/songs/generate/route.test.ts
git commit -m "feat(api): convert song generation to async queue (202 + task creation)"
```

---

### Task 6: 新增 POST /api/tasks/retry API

**Files:**
- Create: `apps/web/src/app/api/tasks/retry/route.ts`
- Create: `apps/web/src/app/api/tasks/retry/route.test.ts`

- [ ] **Step 1: 创建 route.ts**

```ts
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { song_id } = body
  if (!song_id || typeof song_id !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'song_id is required' } },
      { status: 400 }
    )
  }

  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .select('*')
    .eq('song_id', song_id)
    .eq('user_id', user.id)
    .eq('status', 'failed')
    .single()

  if (taskError || !task) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'No failed task found for this song' } },
      { status: 404 }
    )
  }

  const { data: updated, error: updateError } = await supabase
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

  if (updateError || !updated) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: updateError?.message ?? 'Failed to retry task' } },
      { status: 500 }
    )
  }

  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', song_id)
    .eq('user_id', user.id)

  return NextResponse.json({ task: updated })
}
```

- [ ] **Step 2: 创建 route.test.ts**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

function createRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/tasks/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/tasks/retry', () => {
  it('resets failed task to pending and updates song status (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', user_id: 'user-1', status: 'failed', title: 'Song 1' },
    ]
    mockClient.dataStore.generation_tasks = [
      { id: 't1', song_id: 's1', user_id: 'user-1', status: 'failed', type: 'music', retry_count: 3, max_retries: 3 },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.task.status).toBe('pending')
    expect(json.task.retry_count).toBe(0)

    const song = mockClient.dataStore.songs.find((s: any) => s.id === 's1')
    expect(song.status).toBe('generating')
  })

  it('returns 404 if no failed task found', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 if song_id missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({}))

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(createRequest({ song_id: 's1' }))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 3: 运行测试**

Run: `pnpm --filter web test -- --run src/app/api/tasks/retry/route.test.ts`

Expected: 4 个测试全部通过

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/tasks/retry
git commit -m "feat(api): add task retry endpoint for failed generations"
```

---

### Task 7: 创建 Edge Function process-generation-task

**Files:**
- Create: `supabase-local/functions/process-generation-task/index.ts`
- Create: `supabase-local/functions/process-generation-task/.env`

- [ ] **Step 1: 初始化 Edge Function 目录并写代码**

确保目录 `supabase-local/functions/process-generation-task/` 存在，然后创建 `index.ts`：

```ts
// supabase-local/functions/process-generation-task/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface MinimaxResponse {
  data?: { audio?: string; status?: number }
  extra_info?: { music_duration?: number }
}

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const minimaxApiKey = Deno.env.get('MINIMAX_API_KEY')

  if (!supabaseUrl || !serviceRoleKey || !minimaxApiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 1. Claim one pending task
  const { data: task, error: claimError } = await supabase
    .rpc('claim_pending_task', { task_type: 'music' })

  if (claimError || !task) {
    return new Response(
      JSON.stringify({ processed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  try {
    const payload = task.payload as {
      prompt: string
      genre?: string | null
      mood?: string | null
      mode: string
      lyric_id?: string | null
      language?: string | null
    }

    // 2. Build Minimax request
    const minimaxBody: Record<string, unknown> = {
      model: 'music-2.6',
      output_format: 'url',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3',
      },
    }

    const promptParts: string[] = []
    if (payload.language) {
      const langMap: Record<string, string> = { zh: '中文', en: '英文', ja: '日文' }
      if (langMap[payload.language]) promptParts.push(langMap[payload.language])
    }
    promptParts.push(payload.prompt)
    if (payload.genre) promptParts.push(`风格：${payload.genre}`)
    if (payload.mood) promptParts.push(`情绪：${payload.mood}`)

    minimaxBody.prompt = promptParts.join('，')

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

    // 3. Call Minimax API
    const minimaxRes = await fetch('https://api.minimax.chat/v1/music_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${minimaxApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(minimaxBody),
    })

    if (!minimaxRes.ok) {
      throw new Error(`Minimax API error: ${minimaxRes.status}`)
    }

    const minimaxData = (await minimaxRes.json()) as MinimaxResponse
    const audioUrl = minimaxData.data?.audio
    const durationMs = minimaxData.extra_info?.music_duration ?? 0
    const durationSeconds = Math.round(durationMs / 1000)

    if (!audioUrl) {
      throw new Error('Minimax response missing audio URL')
    }

    // 4. Download audio
    const audioRes = await fetch(audioUrl)
    if (!audioRes.ok) throw new Error('Failed to download audio')
    const audioBuffer = await audioRes.arrayBuffer()

    // 5. Upload to Storage
    const filePath = `${task.user_id}/${task.song_id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

    // 6. Get public URL
    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

    // 7. Mark task completed
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
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const retryCount = (task.retry_count ?? 0) + 1

    if (retryCount >= task.max_retries) {
      await supabase
        .from('generation_tasks')
        .update({
          status: 'failed',
          retry_count: retryCount,
          error_message: message,
        })
        .eq('id', task.id)
    } else {
      const delaySeconds = retryCount === 1 ? 0 : retryCount === 2 ? 30 : 60
      const retryAt = new Date(Date.now() + delaySeconds * 1000)

      await supabase
        .from('generation_tasks')
        .update({
          status: 'pending',
          retry_count: retryCount,
          error_message: message,
          created_at: retryAt.toISOString(),
        })
        .eq('id', task.id)
    }

    return new Response(
      JSON.stringify({ processed: 0, error: message, task_id: task.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

- [ ] **Step 2: 创建本地环境变量文件**

创建 `supabase-local/functions/process-generation-task/.env`：

```
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
MINIMAX_API_KEY=<你的 Minimax API Key>
```

**注意：** 将 `<你的 Minimax API Key>` 替换为实际的 Minimax API Key（与 `apps/web` 使用的相同）。本地 Service Role Key 使用 Supabase 本地默认的 token。

- [ ] **Step 3: Commit**

```bash
git add supabase-local/functions/process-generation-task
git commit -m "feat(edge-function): add process-generation-task worker"
```

---

### Task 8: 创建前端 GenerationPanel 轮询组件

**Files:**
- Create: `apps/web/src/app/songs/[id]/generation-panel.tsx`

- [ ] **Step 1: 创建组件**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
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

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/${songId}`)
      if (!res.ok) return
      const data = await res.json()

      if (data.song.status !== status) {
        setStatus(data.song.status)
        if (data.song.status !== 'generating') {
          router.refresh()
        }
      }
    } catch {
      // silently ignore polling errors
    }
  }, [songId, status, router])

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  const handleRetry = async () => {
    setErrorMsg('')
    try {
      const res = await fetch('/api/tasks/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: songId }),
      })
      if (res.ok) {
        setStatus('generating')
      } else {
        const data = await res.json()
        setErrorMsg(data.error?.message || '重试失败，请稍后重试')
      }
    } catch {
      setErrorMsg('网络错误，请稍后重试')
    }
  }

  if (status === 'generating') {
    return (
      <div className="mb-6 rounded-lg border p-6 text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">音乐生成中，请稍候...</p>
        <p className="mt-1 text-xs text-muted-foreground">这通常需要 30-120 秒</p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="mb-6 rounded-lg border border-destructive/50 p-6 text-center">
        <p className="mb-2 text-sm text-destructive">音乐生成失败</p>
        {errorMsg && <p className="mb-3 text-xs text-destructive">{errorMsg}</p>}
        <Button onClick={handleRetry} variant="outline">
          重新生成
        </Button>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/[id]/generation-panel.tsx
git commit -m "feat(ui): add GenerationPanel with polling and retry"
```

---

### Task 9: 改造歌曲详情页使用 GenerationPanel

**Files:**
- Modify: `apps/web/src/app/songs/[id]/page.tsx`

- [ ] **Step 1: 导入组件并替换 generating/failed 区域**

在文件顶部添加 import：

```tsx
import { GenerationPanel } from './generation-panel'
```

搜索并替换原有的 `generating` 和 `failed` / `draft` 条件渲染块。找到以下代码：

```tsx
      {(song.status === 'draft' || song.status === 'failed') && (
        <div className="mb-6 rounded-lg border border-dashed p-6 text-center">
          <div className="mb-2 flex justify-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">
            {song.status === 'failed'
              ? t('status.failed.title')
              : t('status.draft.title')}
          </p>
          <form
            action={`/api/songs/${song.id}/generate`}
            method="POST"
          >
            <Button type="submit" disabled={!song.lyric_id}>
              {song.status === 'failed' ? t('status.failed.action') : t('status.draft.action')}
            </Button>
          </form>
          {!song.lyric_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('lyricRequired')}
            </p>
          )}
        </div>
      )}

      {song.status === 'generating' && (
        <div className="mb-6 rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('status.generating.title')}</p>
        </div>
      )}
```

替换为：

```tsx
      <GenerationPanel songId={song.id} initialStatus={song.status} />
```

**注意：** 保留 `completed` 状态的 `AudioPlayer` 展示逻辑不变。`draft` 状态的原有表单（用于从草稿生成）已被移除，因为本设计下新创建的 song 直接为 `generating` 状态，不再出现 `draft` 的 AI 生成场景。

- [ ] **Step 2: 验证编译**

Run: `pnpm --filter web type-check`

Expected: 无 TypeScript 错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/[id]/page.tsx
git commit -m "feat(ui): integrate GenerationPanel into song detail page"
```

---

### Task 10: 更新数据库类型定义

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: 重新生成类型**

Run: `pnpm supabase:gen:types`

Expected: `packages/supabase/src/database.types.ts` 被更新，包含 `generation_tasks` 表的完整类型定义

- [ ] **Step 2: 验证编译**

Run: `pnpm type-check`

Expected: 所有包类型检查通过

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regenerate database types with generation_tasks"
```

---

### Task 11: 本地端到端验证

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: 更新 .env.local.example 添加 Edge Function 变量注释**

在 `.env.local.example` 末尾添加：

```
# Edge Function 环境变量（本地开发时放在项目根目录 .env，生产通过 supabase secrets set 设置）
# SUPABASE_URL=https://cgqorvwsnuiqtoxzwymr.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# MINIMAX_API_KEY=your-minimax-api-key
```

- [ ] **Step 2: 运行全部单元测试**

Run: `pnpm --filter web test -- --run`

Expected: 所有测试通过（包括新增和修改的测试）

- [ ] **Step 3: 启动本地 Edge Function 并测试**

Run:
```bash
cd supabase-local/functions/process-generation-task
supabase functions serve process-generation-task --env-file .env
```

在另一个终端手动触发：
```bash
curl -X POST http://localhost:54321/functions/v1/process-generation-task \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: 返回 `{"processed":0}`（因为队列中无 pending 任务），HTTP 200

- [ ] **Step 4: 手动插入测试任务验证完整链路**

在数据库中手动插入一条测试任务：

```bash
docker exec -i supabase_db_cgqorvwsnuiqtoxzwymr psql -U postgres -d postgres -c "
INSERT INTO songs (id, user_id, title, status, source)
VALUES ('test-song-001', (SELECT id FROM auth.users LIMIT 1), 'Test Song', 'generating', 'ai_generated');

INSERT INTO generation_tasks (id, user_id, song_id, type, status, payload)
VALUES ('test-task-001', (SELECT id FROM auth.users LIMIT 1), 'test-song-001', 'music', 'pending', '{\"prompt\": \"A short test song\", \"mode\": \"instrumental\"}'::jsonb);
"
```

再次触发 Edge Function：
```bash
curl -X POST http://localhost:54321/functions/v1/process-generation-task \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU" \
  -H "Content-Type: application/json" \
  -d '{}'
```

如果 Minimax API Key 有效，Expected: 返回 `{"processed":1,"task_id":"test-task-001"}`，且数据库中 `generation_tasks` 状态变为 `completed`，`songs` 表 `status` 变为 `completed` 并带有 `audio_url`。

如果无有效 API Key，Expected: 任务进入 `failed` 状态（或 pending 重试），Edge Function 返回包含 `error` 的 JSON。

- [ ] **Step 5: Commit 环境变量模板**

```bash
git add .env.local.example
git commit -m "docs: document Edge Function env vars in .env.local.example"
```

---

### Task 12: 生产环境部署配置

**Files:**
- None (deployment commands only)

- [ ] **Step 1: 部署 Edge Function**

```bash
npx supabase --workdir supabase-local functions deploy process-generation-task
```

- [ ] **Step 2: 设置生产环境变量**

```bash
npx supabase --workdir supabase-local secrets set SUPABASE_URL=https://cgqorvwsnuiqtoxzwymr.supabase.co
npx supabase --workdir supabase-local secrets set SUPABASE_SERVICE_ROLE_KEY=<production-service-role-key>
npx supabase --workdir supabase-local secrets set MINIMAX_API_KEY=<production-minimax-api-key>
```

- [ ] **Step 3: 配置 pg_cron 调度**

在 Supabase Dashboard 的 SQL Editor 中执行：

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'process-generation-tasks',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://cgqorvwsnuiqtoxzwymr.supabase.co/functions/v1/process-generation-task',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <anon-key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'
  ) as request_id;
  $$
);
```

将 `<anon-key>` 替换为项目的 anon/public API key。

- [ ] **Step 4: 验证调度**

Run:
```sql
select * from cron.job where jobname = 'process-generation-tasks';
```

Expected: 返回一行，schedule 为 `* * * * *`

---

## Self-Review Checklist

### 1. Spec coverage

| 设计文档章节 | 对应 Task |
|-------------|----------|
| 4.1 generation_tasks 表 | Task 1 |
| 4.2 claim_pending_task() | Task 2 |
| 4.3 触发器 | Task 3 |
| 5.1 POST /api/songs/generate 改造 | Task 5 |
| 5.2 POST /api/tasks/retry | Task 6 |
| 6 Edge Function | Task 7 |
| 7.2 GenerationPanel | Task 8 |
| 7.3 歌曲详情页改造 | Task 9 |
| 10 测试 | Task 4, 5, 6, 11 |
| 9 pg_cron 调度 | Task 12 |

**无遗漏。**

### 2. Placeholder scan

- 无 "TBD", "TODO", "implement later", "fill in details"
- 所有代码块完整
- 所有命令包含预期输出
- `MINIMAX_API_KEY=<你的 Minimax API Key>` 是明确的环境配置占位（实际值由开发者填入），非实现占位

### 3. Type consistency

- `generation_tasks.status` 值：`'pending'`, `'processing'`, `'completed'`, `'failed'` — 在数据库约束、API 查询、Edge Function 更新、前端组件中完全一致
- `generation_tasks.type` 值：`'music'`, `'cover'`, `'album_cover'` — 在数据库约束和 Edge Function RPC 调用中一致
- `song.status` 值：`'generating'`, `'completed'`, `'failed'` — 在 API 插入、触发器更新、前端轮询中一致
- `payload` 和 `result` 的 JSON 结构在 API 创建、Edge Function 读取、触发器解析中一致

---

*Plan written: 2026-05-09*
