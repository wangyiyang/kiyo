-- Recover tasks left in processing when the worker crashes or times out.
create or replace function claim_pending_task(task_type text)
returns generation_tasks as $$
declare
  claimed_task generation_tasks;
begin
  update generation_tasks
  set
    status = 'failed',
    retry_count = retry_count + 1,
    error_message = 'Task timed out while processing',
    updated_at = now()
  where type = task_type
    and status = 'processing'
    and started_at < now() - interval '15 minutes'
    and retry_count + 1 >= max_retries;

  update generation_tasks
  set
    status = 'pending',
    retry_count = retry_count + 1,
    error_message = 'Task timed out while processing; queued for retry',
    started_at = null,
    created_at = now(),
    updated_at = now()
  where type = task_type
    and status = 'processing'
    and started_at < now() - interval '15 minutes'
    and retry_count + 1 < max_retries;

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
      and created_at <= now()
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
