-- 新增 file_path 字段，用于存储 Supabase Storage 中的文件路径
alter table songs add column file_path text;

-- 回填：将现有 audio_url 转为 file_path
-- 假设 audio_url 格式为 https://host/storage/v1/object/public/audio/{user_id}/{song_id}/{timestamp}.mp3
update songs
set file_path = regexp_replace(
  audio_url,
  '^https?://[^/]+/storage/v1/object/public/audio/',
  ''
)
where audio_url is not null and file_path is null;
