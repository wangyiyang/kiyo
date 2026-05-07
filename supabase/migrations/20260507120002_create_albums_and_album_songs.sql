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

-- 启用 RLS
alter table albums enable row level security;

-- RLS 策略
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

-- 创建 album_songs 关联表
create table album_songs (
  album_id uuid not null references albums(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  order_index int not null default 0,
  created_at timestamptz default now(),
  primary key (album_id, song_id)
);

-- 启用 RLS
alter table album_songs enable row level security;

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

-- albums updated_at 触发器
create trigger update_albums_updated_at
  before update on albums
  for each row
  execute function moddatetime('updated_at');
