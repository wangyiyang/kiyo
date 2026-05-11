-- 扩展任务状态触发器，支持 cover / album_cover 类型任务
-- 当 cover 生成任务完成或失败时，自动回填 songs / albums 表

create or replace function handle_task_status_change()
returns trigger as $$
begin
  -- 音乐任务完成：回填 songs 表
  if new.status = 'completed' and new.song_id is not null and new.type = 'music' then
    update songs
    set
      status = 'completed',
      audio_url = (new.result->>'audio_url')::text,
      file_path = (new.result->>'file_path')::text,
      duration = (new.result->>'duration')::int,
      updated_at = now()
    where id = new.song_id;

  -- 音乐任务失败：标记 song 为 failed
  elsif new.status = 'failed' and new.song_id is not null and new.type = 'music' then
    update songs
    set
      status = 'failed',
      updated_at = now()
    where id = new.song_id;

  -- 歌曲封面任务完成：回填 songs.cover_url
  elsif new.status = 'completed' and new.song_id is not null and new.type = 'cover' then
    update songs
    set
      cover_url = (new.result->>'cover_url')::text,
      cover_status = 'completed',
      updated_at = now()
    where id = new.song_id;

  -- 歌曲封面任务失败
  elsif new.status = 'failed' and new.song_id is not null and new.type = 'cover' then
    update songs
    set
      cover_status = 'failed',
      updated_at = now()
    where id = new.song_id;

  -- 专辑封面任务完成：回填 albums.cover_url
  elsif new.status = 'completed' and new.album_id is not null and new.type = 'album_cover' then
    update albums
    set
      cover_url = (new.result->>'cover_url')::text,
      cover_status = 'completed',
      updated_at = now()
    where id = new.album_id;

  -- 专辑封面任务失败
  elsif new.status = 'failed' and new.album_id is not null and new.type = 'album_cover' then
    update albums
    set
      cover_status = 'failed',
      updated_at = now()
    where id = new.album_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;
