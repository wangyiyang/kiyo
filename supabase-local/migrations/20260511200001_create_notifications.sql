create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  song_id uuid references songs(id) on delete set null,
  album_id uuid references albums(id) on delete set null,

  type text not null,
  subtype text not null,

  template_key text not null,
  template_params jsonb not null default '{}',

  is_read boolean not null default false,

  target_url text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notifications
  add constraint notifications_type_check
  check (type in ('generation'));

alter table notifications
  add constraint notifications_subtype_check
  check (subtype in ('started', 'completed', 'failed'));

create index idx_notifications_user_unread
  on notifications (user_id, created_at desc)
  where is_read = false;

create index idx_notifications_user
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

create policy "notifications_user_select"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_user_update"
  on notifications for update to authenticated
  using (user_id = auth.uid());

create trigger update_notifications_updated_at
  before update on notifications
  for each row
  execute function moddatetime('updated_at');

create or replace function handle_task_notification()
returns trigger as $$
declare
  v_title text;
begin
  begin
    -- album_cover tasks do not generate notifications (no standalone detail page)
    if new.type not in ('music', 'cover') then
      return new;
    end if;

    if new.song_id is not null then
      select title into v_title from songs where id = new.song_id;
    end if;

    if new.status = 'completed' and old.status <> 'completed' then
      insert into notifications (user_id, song_id, type, subtype, template_key, template_params)
      values (
        new.user_id,
        new.song_id,
        'generation',
        'completed',
        'notification.generation.completed',
        jsonb_build_object('songTitle', coalesce(v_title, '未命名'))
      );
    end if;

    if new.status = 'failed' and old.status <> 'failed' then
      insert into notifications (user_id, song_id, type, subtype, template_key, template_params)
      values (
        new.user_id,
        new.song_id,
        'generation',
        'failed',
        'notification.generation.failed',
        jsonb_build_object('songTitle', coalesce(v_title, '未命名'))
      );
    end if;
  exception when others then
    raise warning 'Failed to create notification: %', sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer;

create trigger generation_tasks_notification
  after update on generation_tasks
  for each row
  when (old.status is distinct from new.status)
  execute function handle_task_notification();

alter publication supabase_realtime add table notifications;
