-- 新增 is_featured 字段
alter table songs add column if not exists is_featured boolean default false;

-- 新增 description 到 albums（如果已存在则跳过）
alter table albums add column if not exists description text;

-- 新增 genre 到 albums（方便分类展示）
alter table albums add column if not exists genre text;

-- 匿名用户可读取精选歌曲
drop policy if exists "anon_read_featured_songs" on songs;
create policy "anon_read_featured_songs"
  on songs for select
  to anon
  using (is_featured = true);

-- 匿名用户可读取精选歌曲关联的专辑（通过 album_songs 反向查找）
drop policy if exists "anon_read_featured_albums" on albums;
create policy "anon_read_featured_albums"
  on albums for select
  to anon
  using (id in (
    select distinct a.id from albums a
    join album_songs als on a.id = als.album_id
    join songs s on als.song_id = s.id
    where s.is_featured = true
  ));

-- 匿名用户可读取 album_songs 关联（精选歌曲对应的专辑曲目关系）
drop policy if exists "anon_read_featured_album_songs" on album_songs;
create policy "anon_read_featured_album_songs"
  on album_songs for select
  to anon
  using (song_id in (select id from songs where is_featured = true));
