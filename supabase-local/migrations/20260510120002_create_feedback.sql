-- 用户反馈表
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  
  -- 用户信息（可选，未登录用户可提交）
  user_id uuid references auth.users(id) on delete set null,
  
  -- 反馈类型
  type text not null check (type in ('bug', 'suggestion', 'other')),
  
  -- 反馈描述
  description text not null,
  
  -- 联系方式（可选）
  contact text,
  
  -- 时间戳
  created_at timestamptz default now()
);

-- 索引
create index idx_feedback_created_at on feedback (created_at desc);
create index idx_feedback_type on feedback (type);

-- RLS 策略
alter table feedback enable row level security;

-- 所有人可插入（匿名反馈）
create policy "feedback_insert"
  on feedback
  for insert
  to public
  with check (true);

-- 仅管理员可查询和删除（通过服务角色 key）
create policy "feedback_admin_read"
  on feedback
  for select
  to service_role
  using (true);

create policy "feedback_admin_delete"
  on feedback
  for delete
  to service_role
  using (true);