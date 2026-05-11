-- 速率限制表，用于滑动窗口计数
-- 支持按用户 ID 和 IP 地址双重维度限流
create table rate_limits (
  id uuid primary key default gen_random_uuid(),

  -- 限流维度标识（用户ID或IP地址）
  key text not null,

  -- 限流类型：lyrics_generate, song_generate, cover_generate, image_generate, task_retry
  action text not null,

  -- 请求时间戳（用于滑动窗口计算）
  created_at timestamptz default now()
);

-- 复合索引：快速查询特定 key + action + 时间窗口内的记录
-- 同时支持定期清理过期数据
create index idx_rate_limits_key_action_created
  on rate_limits (key, action, created_at);

-- 单独索引用于清理过期数据
create index idx_rate_limits_created_at
  on rate_limits (created_at);

-- 检查约束：限制 action 取值范围
alter table rate_limits
  add constraint rate_limits_action_check
  check (action in (
    'lyrics_generate',
    'song_generate',
    'cover_generate',
    'image_generate',
    'task_retry'
  ));

-- 该表不需要 RLS，仅由服务端通过 service_role 或匿名查询使用
-- 但为了安全，仍然启用 RLS 并禁止直接访问
alter table rate_limits enable row level security;

create policy "rate_limits_no_direct_access"
  on rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);
