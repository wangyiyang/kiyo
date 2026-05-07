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
