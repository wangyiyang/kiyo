-- 扩展 songs 表字段
alter table songs add column audio_url text;
alter table songs add column cover_url text;
alter table songs add column lyric_id uuid references lyrics(id) on delete set null;
alter table songs add column status text not null default 'draft';
alter table songs add column duration int;
alter table songs add column genre text;
alter table songs add column mood text;
alter table songs add column source text not null default 'manual';
alter table songs add column ai_prompt text;

-- 添加检查约束
alter table songs add constraint songs_status_check
  check (status in ('draft', 'generating', 'completed', 'failed'));
alter table songs add constraint songs_source_check
  check (source in ('ai_generated', 'manual'));
