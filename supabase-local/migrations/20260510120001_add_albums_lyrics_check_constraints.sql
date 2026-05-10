-- 添加 albums/lyrics 表的 CHECK 约束，补全数据完整性
-- 使用 NOT VALID 避免要求现有数据满足约束，只验证新插入/更新的数据
-- 后续可以通过 ALTER TABLE ... VALIDATE CONSTRAINT 逐步验证旧数据

-- albums: cover_status 约束
alter table albums add constraint albums_cover_status_check
  check (cover_status in ('none', 'generating', 'completed', 'failed')) not valid;

-- albums: status 约束 (draft/generating/completed/failed)
-- 注意：NOT VALID 允许已存在的 completed/published 状态通过
alter table albums add constraint albums_status_check
  check (status in ('draft', 'generating', 'completed', 'failed')) not valid;

-- lyrics: source 约束
alter table lyrics add constraint lyrics_source_check
  check (source in ('ai_generated', 'manual')) not valid;

-- lyrics: status 约束
alter table lyrics add constraint lyrics_status_check
  check (status in ('draft', 'published')) not valid;
