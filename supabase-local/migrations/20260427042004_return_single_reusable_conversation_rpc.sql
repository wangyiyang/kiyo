-- 兼容远程历史迁移记录。
-- 当前 Kiyo schema 不再管理 conversations / messages；仅当旧表存在时重建旧 RPC。
do $$
begin
  if to_regclass('public.conversations') is not null
    and to_regclass('public.messages') is not null
  then
    drop function if exists public.find_reusable_conversation();

    execute $function$
      create function public.find_reusable_conversation()
      returns public.conversations
      language sql
      security invoker
      set search_path = public
      as $sql$
        select c.*
        from public.conversations c
        where c.user_id = auth.uid()
          and c.title = '新对话'
          and not exists (
            select 1
            from public.messages m
            where m.conversation_id = c.id
          )
        order by c.updated_at desc
        limit 1;
      $sql$;
    $function$;
  end if;
end;
$$;
