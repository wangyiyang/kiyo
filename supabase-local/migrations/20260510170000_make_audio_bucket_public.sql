-- Public showcase and explore pages play seeded/generated audio via public URLs.
-- Ensure the audio bucket exists and is public; keep owner write policies in place.

insert into storage.buckets (id, name, public)
values ('audio', 'audio', true)
on conflict (id) do update set public = true;

drop policy if exists "audio_public_select" on storage.objects;
create policy "audio_public_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'audio');
