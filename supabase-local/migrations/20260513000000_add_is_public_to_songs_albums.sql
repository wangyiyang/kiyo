-- 给 songs 表添加公开分享开关
alter table songs add column is_public boolean not null default false;

-- 给 albums 表添加公开分享开关
alter table albums add column is_public boolean not null default false;

-- 收紧匿名读取策略：仅允许读取公开作品
drop policy if exists "anon_read_all_songs" on songs;
create policy "anon_read_public_songs"
  on songs for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_albums" on albums;
create policy "anon_read_public_albums"
  on albums for select
  to anon
  using (is_public = true);

drop policy if exists "anon_read_all_album_songs" on album_songs;
create policy "anon_read_public_album_songs"
  on album_songs for select
  to anon
  using (
    album_id in (select id from albums where is_public = true)
    and song_id in (select id from songs where is_public = true)
  );

-- 允许已登录用户读取公开歌曲
create policy "authenticated_read_public_songs"
  on songs for select
  to authenticated
  using (is_public = true);

-- 允许已登录用户读取公开专辑
create policy "authenticated_read_public_albums"
  on albums for select
  to authenticated
  using (is_public = true);

-- 允许已登录用户读取公开专辑中的公开歌曲关联
create policy "authenticated_read_public_album_songs"
  on album_songs for select
  to authenticated
  using (
    album_id in (select id from albums where is_public = true)
    and song_id in (select id from songs where is_public = true)
  );

-- 为公开状态查询添加索引
create index idx_songs_is_public on songs(is_public);
create index idx_albums_is_public on albums(is_public);
