# 数据库迁移文件规范

## 结论

Kiyo 的数据库迁移文件统一放在 `supabase-local/migrations/`，以时间戳前缀排序执行。任何 schema、RLS、函数、触发器、Storage policy 变更都必须通过迁移文件落地；不要在 Supabase Dashboard 里手动改完后不补迁移。

## 目录与命名

迁移目录：

```text
supabase-local/migrations/
```

命名格式：

```text
YYYYMMDDHHMMSS_descriptive_name.sql
```

示例：

```text
20260511180000_create_rate_limits.sql
20260512000000_create_delete_user_data_function.sql
```

命名原则：

- 时间戳必须单调递增，保证执行顺序明确。
- 文件名用小写英文和下划线，表达“做了什么”，不要写 issue 编号当主语。
- 一个迁移文件只做一类相关变更；不要把无关表、函数、策略塞进同一个文件。
- 已经推到远程的迁移文件原则上不能改内容；如需修正，新增后续迁移。

## CLI 目录兼容

本仓库使用自定义 Supabase 工作目录：

```bash
npx supabase --workdir supabase-local ...
```

当前 Supabase CLI 会在 `supabase-local/supabase/migrations` 下查找迁移。仓库实际迁移目录是 `supabase-local/migrations`，因此本地需要一个被 `.gitignore` 忽略的软链接：

```bash
mkdir -p supabase-local/supabase
ln -sfn ../migrations supabase-local/supabase/migrations
```

以后直接执行：

```bash
make db-doctor
```

该命令只修复本地 CLI 目录兼容，不会修改数据库。

## 文件内容规则

迁移 SQL 要满足四个要求：

1. **可重放**：本地从空库执行迁移链时能成功。
2. **可审查**：DDL、RLS、权限语句清晰分组，注释说明业务原因。
3. **最小权限**：函数、策略、表权限必须显式控制，不依赖默认权限。
4. **向前修复**：远程已执行的迁移不回改，使用新迁移修正。

推荐写法：

```sql
create or replace function public.example_function(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 业务逻辑
end;
$$;

revoke all on function public.example_function(uuid) from public;
revoke all on function public.example_function(uuid) from anon, authenticated;
grant execute on function public.example_function(uuid) to service_role;
```

要点：

- `security definer` 函数必须固定 `search_path`。
- 需要服务端调用的函数只授权 `service_role`。
- RLS 表必须同时考虑 `select`、`insert`、`update`、`delete`。
- Storage policy 迁移要写清楚 bucket、operation、role 和路径约束。

## 历史兼容迁移

远程项目 `Lichun` 存在两条早期迁移历史：

```text
20260427041843_scope_reusable_conversation_rpc.sql
20260427042004_return_single_reusable_conversation_rpc.sql
```

这两条对应旧的 `conversations/messages` RPC，不属于当前 Kiyo 主 schema，但远程迁移历史表中已有记录。为了让 `supabase db push` 能比较本地和远程历史，仓库保留了同名兼容迁移文件。

兼容迁移的原则：

- 只用于对齐远程历史。
- 必须使用 `to_regclass(...) is not null` 判断旧表存在后再执行。
- 在当前从零本地库中应为 no-op，不能引入旧业务表。

## 提交前检查

提交迁移文件前至少执行：

```bash
make db-list-local
make db-push-local-dry-run
make db-push-local
make db-gen-types
pnpm type-check
git diff --check
```

远程推送前必须额外执行：

```bash
make db-backup-remote
make db-push-remote-dry-run
```

## 禁止事项

- 禁止提交 `.env`、数据库密码、dump 文件。
- 禁止直接在 `main` 分支做迁移提交。
- 禁止跳过远程备份直接 `db push --linked`。
- 禁止用 `migration repair` 作为常规手段；只有确认远程迁移历史错误时才使用。
- 禁止删除或重写已经远程应用过的迁移文件。
