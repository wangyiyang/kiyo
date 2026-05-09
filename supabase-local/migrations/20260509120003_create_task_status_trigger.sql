create or replace function handle_task_status_change()
returns trigger as $$
begin
  -- 任务完成：回填 songs 表
  if new.status = 'completed' and new.song_id is not null then
    update songs
    set
      status = 'completed',
      audio_url = (new.result->>'audio_url')::text,
      file_path = (new.result->>'file_path')::text,
      duration = (new.result->>'duration')::int,
      updated_at = now()
    where id = new.song_id;

  -- 任务失败：标记 song 为 failed
  elsif new.status = 'failed' and new.song_id is not null then
    update songs
    set
      status = 'failed',
      updated_at = now()
    where id = new.song_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger generation_tasks_status_change
  after update on generation_tasks
  for each row
  when (old.status is distinct from new.status)
  execute function handle_task_status_change();
