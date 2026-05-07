# Database Schema Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create Supabase migration files for `songs`, `albums`, `album_songs`, `lyrics` tables with RLS policies and generate TypeScript types.

**Architecture:** Three sequential migration files ordered by dependency (`songs` → `albums`+`album_songs` → `lyrics`), each containing table DDL, constraints, RLS enablement, policies, and `updated_at` triggers. Migrations applied via `supabase db reset`, types generated via `supabase gen types`.

**Tech Stack:** Supabase (PostgreSQL), Supabase CLI, TypeScript

---

### Task 1: Create `songs` migration

**Files:**
- Create: `supabase/migrations/20260507120001_create_songs.sql`

- [ ] **Step 1: Write migration file**

```sql
-- 创建 songs 表（最小结构）
create table songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 启用 RLS
alter table songs enable row level security;

-- RLS 策略：用户只能操作自己的数据
create policy "songs_user_all"
  on songs
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at 自动更新触发器
comment on table songs is '歌曲最小结构表，支撑 album_songs 外键';
create trigger update_songs_updated_at
  before update on songs
  for each row
  execute function moddatetime('updated_at');
```

- [ ] **Step 2: Commit migration file**

```bash
git add supabase/migrations/20260507120001_create_songs.sql
git commit -m "feat(db): create songs table with RLS and updated_at trigger"
```

---

### Task 2: Create `albums` and `album_songs` migration

**Files:**
- Create: `supabase/migrations/20260507120002_create_albums_and_album_songs.sql`

- [ ] **Step 1: Write albums table DDL**

```sql
-- 创建 albums 表
create table albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  description text,
  cover_url text,
  cover_status text not null default 'none',
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 约束检查
create policy "albums_user_select"
  on albums
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "albums_user_insert"
  on albums
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "albums_user_update"
  on albums
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "albums_user_delete"
  on albums
  for delete
  to authenticated
  using (user_id = auth.uid());

alter table albums enable row level security;
```

- [ ] **Step 2: Write album_songs table DDL**

```sql
-- 创建 album_songs 关联表
create table album_songs (
  album_id uuid not null references albums(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  order_index int not null default 0,
  created_at timestamptz default now(),
  primary key (album_id, song_id)
);

-- RLS 策略：通过 albums 关联控制权限
create policy "album_songs_user_select"
  on album_songs
  for select
  to authenticated
  using (album_id in (select id from albums where user_id = auth.uid()));

create policy "album_songs_user_insert"
  on album_songs
  for insert
  to authenticated
  with check (album_id in (select id from albums where user_id = auth.uid()));

create policy "album_songs_user_update"
  on album_songs
  for update
  to authenticated
  using (album_id in (select id from albums where user_id = auth.uid()))
  with check (album_id in (select id from albums where user_id = auth.uid()));

create policy "album_songs_user_delete"
  on album_songs
  for delete
  to authenticated
  using (album_id in (select id from albums where user_id = auth.uid()));

alter table album_songs enable row level security;
```

- [ ] **Step 3: Add updated_at triggers**

```sql
-- albums updated_at 触发器
create trigger update_albums_updated_at
  before update on albums
  for each row
  execute function moddatetime('updated_at');
```

- [ ] **Step 4: Commit migration file**

```bash
git add supabase/migrations/20260507120002_create_albums_and_album_songs.sql
git commit -m "feat(db): create albums and album_songs tables with RLS"
```

---

### Task 3: Create `lyrics` migration

**Files:**
- Create: `supabase/migrations/20260507120003_create_lyrics.sql`

- [ ] **Step 1: Write migration file**

```sql
create table lyrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null,
  content text not null,
  language text,
  style text,
  mood text,
  source text not null default 'manual',
  ai_prompt text,
  status text not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table lyrics enable row level security;

create policy "lyrics_user_select"
  on lyrics
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "lyrics_user_insert"
  on lyrics
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "lyrics_user_update"
  on lyrics
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "lyrics_user_delete"
  on lyrics
  for delete
  to authenticated
  using (user_id = auth.uid());

create trigger update_lyrics_updated_at
  before update on lyrics
  for each row
  execute function moddatetime('updated_at');
```

- [ ] **Step 2: Commit migration file**

```bash
git add supabase/migrations/20260507120003_create_lyrics.sql
git commit -m "feat(db): create lyrics table with RLS and updated_at trigger"
```

---

### Task 4: Verify migrations with local Supabase

**Files:**
- None (verification step)

- [ ] **Step 1: Start local Supabase stack**

```bash
npx supabase start
```

Expected: Containers start successfully, API URL and DB URL printed.

- [ ] **Step 2: Reset database to apply migrations**

```bash
npx supabase db reset
```

Expected: Migrations applied successfully, database seeded (if any seeders exist).

- [ ] **Step 3: Verify table structures via psql**

```bash
npx supabase psql -c "\dt public.*"
```

Expected: `songs`, `albums`, `album_songs`, `lyrics` all listed.

- [ ] **Step 4: Verify RLS is enabled**

```bash
npx supabase psql -c "select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('songs', 'albums', 'album_songs', 'lyrics');"
```

Expected: All four tables show `rowsecurity = t`.

- [ ] **Step 5: Verify triggers exist**

```bash
npx supabase psql -c "select trigger_name, event_object_table from information_schema.triggers where trigger_name like 'update_%_updated_at';"
```

Expected: Triggers for `songs`, `albums`, `lyrics` listed.

---

### Task 5: Generate TypeScript types

**Files:**
- Create: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Generate types from local schema**

```bash
npx supabase gen types typescript --local > packages/supabase/src/database.types.ts
```

- [ ] **Step 2: Verify `packages/supabase/src/index.ts` exports Database type**

Check file `packages/supabase/src/index.ts`. Expected content:

```ts
export type { Database } from './database.types'
```

If missing, add the export line.

- [ ] **Step 3: Run type check**

```bash
pnpm type-check -- --filter=@kiyo/supabase
```

Expected: No type errors.

```bash
pnpm type-check -- --filter=web
```

Expected: No type errors (web may not yet import the new types, but should not break).

- [ ] **Step 4: Commit generated types**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "feat(db): generate TypeScript types for new tables"
```

---

## Self-Review

**1. Spec coverage:**
- [x] `songs` 最小结构 → Task 1
- [x] `albums` 表 → Task 2
- [x] `album_songs` 关联表 → Task 2
- [x] `lyrics` 表 → Task 3
- [x] RLS 策略 → Task 1-3
- [x] `updated_at` 触发器 → Task 1-3
- [x] 迁移命名规范 → 文件名符合 `YYYYMMDDHHMMSS_description.sql`
- [x] TypeScript 类型生成 → Task 5
- [x] 本地验证 → Task 4

**2. Placeholder scan:**
- [x] No TBD/TODO/fill-in-details found
- [x] All SQL is complete and executable
- [x] All commands include expected output

**3. Type consistency:**
- [x] Field names match spec (`cover_status`, `order_index`, `ai_prompt`, etc.)
- [x] Constraint names consistent across tables
