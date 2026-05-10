-- 允许匿名用户读取所有歌曲（用于 explore 页面展示全部歌曲）
drop policy if exists "anon_read_featured_songs" on songs;
create policy "anon_read_all_songs"
  on songs for select
  to anon
  using (true);

-- 允许匿名用户读取所有专辑
drop policy if exists "anon_read_featured_albums" on albums;
create policy "anon_read_all_albums"
  on albums for select
  to anon
  using (true);

-- 允许匿名用户读取所有 album_songs 关联
drop policy if exists "anon_read_featured_album_songs" on album_songs;
create policy "anon_read_all_album_songs"
  on album_songs for select
  to anon
  using (true);
