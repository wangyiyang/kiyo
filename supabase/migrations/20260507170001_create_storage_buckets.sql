-- 创建 covers Storage bucket（公开读取）
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- 创建 audio Storage bucket（预留，暂不公开）
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;

-- ============================================
-- covers bucket policies
-- ============================================

-- 公开读取：任何人可访问封面图片

create policy "covers_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'covers');

-- 仅所有者可上传：路径必须以 user_id 开头

create policy "covers_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅所有者可更新

create policy "covers_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅所有者可删除

create policy "covers_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- audio bucket policies（预留，仅所有者访问）
-- ============================================

-- 仅所有者可读取

create policy "audio_owner_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅所有者可上传

create policy "audio_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅所有者可更新

create policy "audio_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 仅所有者可删除

create policy "audio_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );