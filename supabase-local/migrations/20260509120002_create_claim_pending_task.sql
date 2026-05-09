create or replace function claim_pending_task(task_type text)
returns generation_tasks as $$
declare
  claimed_task generation_tasks;
begin
  update generation_tasks
  set
    status = 'processing',
    started_at = now(),
    updated_at = now()
  where id = (
    select id
    from generation_tasks
    where status = 'pending'
      and type = task_type
    order by created_at
    for update skip locked
    limit 1
  )
  returning * into claimed_task;

  if claimed_task.id is null then
    return null;
  end if;

  return claimed_task;
end;
$$ language plpgsql security definer;
