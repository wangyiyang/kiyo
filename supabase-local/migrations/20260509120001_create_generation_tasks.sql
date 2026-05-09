-- 任务队列表，管理所有异步 AI 生成任务
create table generation_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  -- 关联业务对象（根据任务类型 nullable）
  song_id uuid references songs(id) on delete cascade,
  album_id uuid references albums(id) on delete cascade,

  -- 任务类型
  type text not null,

  -- 执行状态
  status text not null default 'pending',

  -- 重试计数
  retry_count int not null default 0,
  max_retries int not null default 3,

  -- 错误信息
  error_message text,

  -- 任务输入参数（Minimax 调用参数）
  payload jsonb not null default '{}',

  -- 任务执行结果（audio_url, duration 等）
  result jsonb,

  -- 时间戳
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 检查约束
alter table generation_tasks
  add constraint generation_tasks_type_check
  check (type in ('music', 'cover', 'album_cover'));

alter table generation_tasks
  add constraint generation_tasks_status_check
  check (status in ('pending', 'processing', 'completed', 'failed'));

-- 索引：快速查找待处理任务（Edge Function 消费用）
create index idx_generation_tasks_pending
  on generation_tasks (status, type, created_at)
  where status in ('pending', 'processing');

-- RLS
alter table generation_tasks enable row level security;

create policy "generation_tasks_user_all"
  on generation_tasks
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at 自动更新
create trigger update_generation_tasks_updated_at
  before update on generation_tasks
  for each row
  execute function moddatetime('updated_at');
