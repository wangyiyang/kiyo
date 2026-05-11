-- 扩展 Waitlist 表字段，支持用户画像收集
-- 旧 role 列保留兼容，新字段使用新列名

alter table public.waitlist
  add column role_new text,
  add column interests text[],
  add column use_scenes text[];

comment on column public.waitlist.role_new is '用户在音乐创作中的角色：beginner/enthusiast/indie/professional/songwriter/other';
comment on column public.waitlist.interests is '感兴趣的功能，多选：composition/arrangement/vocal/mixing/cover/lyrics';
comment on column public.waitlist.use_scenes is '使用场景，多选：personal/commercial/education/social';
