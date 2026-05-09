-- Waitlist: 落地页邮件订阅
-- 设计原则：
-- 1. 仅允许 anon/authenticated 写入 (insert-only)，禁止读取，防止邮箱枚举
-- 2. email 唯一 + POSIX 格式校验 (使用 [[:space:]] 而不是 \s, PostgreSQL ~* 是 POSIX 正则)
-- 3. role 自由文本，不强约束，让前端 zod enum 兜底，业务变更不需要迁移

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text,
  source text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint waitlist_email_unique unique (email),
  constraint waitlist_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

alter table public.waitlist enable row level security;

-- 公开 insert 策略：匿名访客也能加入 waitlist
create policy "waitlist_insert_public" on public.waitlist
  for insert to anon, authenticated
  with check (true);

-- 显式 revoke select 防止枚举：默认 grant 给 authenticated 也要拿掉
revoke select on public.waitlist from anon, authenticated;

create index waitlist_created_at_idx on public.waitlist (created_at desc);

comment on table public.waitlist is '落地页 Waitlist 邮件订阅';
comment on column public.waitlist.role is '自我标签：producer / songwriter / enthusiast / other';
comment on column public.waitlist.source is '来源标记，如 landing / share / referral';
