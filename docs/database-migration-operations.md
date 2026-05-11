# 数据库迁移操作手册

## 结论

数据库迁移按固定顺序执行：**修复 CLI 目录 → 备份 → dry-run → push → 验证 → 生成类型**。远程迁移必须先备份，不能直接推。

## 前置条件

本地依赖：

```bash
pnpm install
npx supabase --version
```

本地 Supabase：

```bash
make supabase-start
make supabase-status
```

远程数据库密码放在：

```text
supabase/.env
```

内容格式：

```bash
SUPABASE_DB_PASSWORD=你的远程数据库密码
```

`supabase/.env` 已被 `.gitignore` 忽略，不要提交。

## 本地迁移流程

### 1. 新建迁移

```bash
make db-new name=create_example_table
```

生成文件后，编辑：

```text
supabase-local/migrations/<timestamp>_create_example_table.sql
```

### 2. 本地备份

```bash
make db-backup-local
```

备份会写入：

```text
/home/kk/supabase-backups/kiyo/
```

### 3. 本地 dry-run

```bash
make db-push-local-dry-run
```

### 4. 本地应用迁移

```bash
make db-push-local
```

如果需要从头重放全部迁移：

```bash
make db-reset-local
```

`db-reset-local` 会重置本地库，只能在本地使用。

### 5. 生成类型

```bash
make db-gen-types
```

生成文件：

```text
packages/supabase/src/database.types.ts
```

### 6. 验证

```bash
make db-list-local
pnpm type-check
git diff --check
```

## 远程迁移流程

### 1. 确认远程项目

```bash
make db-list-remote
```

远程项目应为 Supabase Dashboard 中的 `Lichun`，项目 ref 为：

```text
cgqorvwsnuiqtoxzwymr
```

### 2. 远程备份

```bash
make db-backup-remote
```

每次会生成一个新目录：

```text
/home/kk/supabase-backups/kiyo/remote-before-migration-YYYYMMDD-HHMMSS/
```

包含：

```text
roles.sql
schema.sql
data.sql
```

如果 `data.sql` 备份时提示自引用外键或循环外键，这是 `pg_dump --data-only` 的恢复提示；只要文件已生成且非空，备份本身成功。

### 3. 远程 dry-run

```bash
make db-push-remote-dry-run
```

只确认将要推送的迁移，不修改远程数据库。

### 4. 远程推送

```bash
make db-push-remote
```

更傻瓜的一键流程：

```bash
make db-migrate-remote
```

它会依次执行：

```text
db-doctor → db-backup-remote → db-push-remote-dry-run → db-push-remote → db-list-remote
```

### 5. 远程验证

```bash
make db-verify-remote
```

该命令会再次执行 remote dry-run。若输出 `Remote database is up to date`，说明没有待推迁移。

## 常见问题

### 密码认证失败

错误：

```text
password authentication failed for user "postgres"
```

处理：

1. 到 Supabase Dashboard 的 Database Settings 重置数据库密码。
2. 更新 `supabase/.env` 中的 `SUPABASE_DB_PASSWORD`。
3. 重新执行 `make db-backup-remote`。

### 远程迁移历史本地缺失

错误：

```text
Remote migration versions not found in local migrations directory.
```

处理顺序：

1. 先确认本地仓库是最新分支。
2. 检查 `supabase-local/migrations/` 是否有远程提示的版本文件。
3. 如果是历史旧库遗留迁移，补本地兼容迁移文件，不直接 repair 远程历史。
4. 只有确认远程历史表错误时，才考虑 `supabase migration repair`。

### CLI 误报 remote up to date

如果本地库没有 `supabase_migrations` 表，但 CLI 仍说 up to date，通常是 CLI 没读到迁移目录。

先执行：

```bash
make db-doctor
```

再执行：

```bash
make db-list-local
```

## 回滚与恢复

迁移推远程后，不直接删除远程迁移记录，也不直接改旧迁移文件。

常规恢复策略：

1. 立即停止继续写入相关业务路径。
2. 使用备份目录中的 `schema.sql` / `data.sql` 分析影响范围。
3. 写一个新的向前修复迁移。
4. 必要时用 Supabase Dashboard 或 `psql` 在维护窗口恢复数据。

## 操作纪律

- 远程迁移前必须备份。
- 远程迁移前必须 dry-run。
- 推远程后必须验证 `Remote database is up to date`。
- schema 变化后必须生成 `database.types.ts`。
- 所有迁移相关 PR 必须写明备份位置、dry-run 结果、push 结果、验证结果。
