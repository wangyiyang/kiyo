-- 添加 original_song_id 自引用外键
alter table songs add column original_song_id uuid references songs(id) on delete set null;

-- 添加 voice_style 字段记录翻唱风格
alter table songs add column voice_style text;

-- 扩展 source 约束，增加 ai_cover
alter table songs drop constraint songs_source_check;
alter table songs add constraint songs_source_check
  check (source in ('manual', 'ai_generated', 'ai_cover'));
