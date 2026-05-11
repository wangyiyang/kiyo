-- 创建 delete_user_data RPC 函数
-- 原子删除用户全部数据，供服务端 API 调用

create or replace function public.delete_user_data(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  target_email text;
begin
  -- 获取用户邮箱（waitlist 清理需要）
  select email into target_email
  from auth.users
  where id = target_user_id;

  if target_email is null then
    raise exception 'User not found';
  end if;

  -- 1. generation_tasks（可能引用 songs/albums，先删避免外键冲突）
  delete from generation_tasks where user_id = target_user_id;

  -- 2. songs（album_songs 级联自动清理）
  delete from songs where user_id = target_user_id;

  -- 3. albums（album_songs 级联自动清理）
  delete from albums where user_id = target_user_id;

  -- 4. lyrics
  delete from lyrics where user_id = target_user_id;

  -- 5. waitlist（按 email 匹配）
  delete from waitlist where email = target_email;
end;
$$;

comment on function public.delete_user_data(uuid) is '级联删除用户的全部数据（供账户删除 API 使用）';
