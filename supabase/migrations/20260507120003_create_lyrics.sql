-- 创建 lyrics 表
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

-- 启用 RLS
alter table lyrics enable row level security;

-- RLS 策略
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

-- updated_at 触发器
create trigger update_lyrics_updated_at
  before update on lyrics
  for each row
  execute function moddatetime('updated_at');
