# 数据库 Schema 设计：albums、album_songs、lyrics 及 songs 最小结构

## 目的

为 Kiyo 项目的专辑管理、歌词管理功能设计并实现数据库 Schema，包含迁移文件、RLS 策略及 TypeScript 类型定义，确保本地开发环境可一键重置验证。

## 背景

- GitHub Issue #4 要求创建 `albums`、`album_songs`、`lyrics` 三张核心表
- `album_songs` 的 `song_id` 外键依赖 `songs` 表，但 `songs` 表尚未设计
- 经 MCP `list_tables` 验证，远程 Supabase 项目 `Lichun` 中上述四表均不存在
- 决策：同步创建 `songs` 最小结构，本期不阻塞 `album_songs` 外键约束

## 方案

### 数据模型

#### `songs` 表（最小结构）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | 歌曲唯一标识 |
| `user_id` | `uuid` | `NOT NULL REFERENCES auth.users(id)` | 所有者 |
| `title` | `text` | `NOT NULL` | 歌曲名称 |
| `created_at` | `timestamptz` | `DEFAULT now()` | 创建时间 |
| `updated_at` | `timestamptz` | `DEFAULT now()` | 更新时间 |

> `songs` 完整字段（音频 URL、时长、风格等）留待后续迭代。

#### `albums` 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | 专辑唯一标识 |
| `user_id` | `uuid` | `NOT NULL REFERENCES auth.users(id)` | 所有者 |
| `title` | `text` | `NOT NULL` | 专辑名称 |
| `description` | `text` | nullable | 专辑描述 |
| `cover_url` | `text` | nullable | 封面图片 URL |
| `cover_status` | `text` | `NOT NULL DEFAULT 'none'` | `none`/`generating`/`completed`/`failed` |
| `status` | `text` | `NOT NULL DEFAULT 'draft'` | `draft`/`published` |
| `created_at` | `timestamptz` | `DEFAULT now()` | 创建时间 |
| `updated_at` | `timestamptz` | `DEFAULT now()` | 更新时间 |

#### `album_songs` 关联表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `album_id` | `uuid` | `NOT NULL REFERENCES albums(id) ON DELETE CASCADE` | 专辑 ID |
| `song_id` | `uuid` | `NOT NULL REFERENCES songs(id) ON DELETE CASCADE` | 歌曲 ID |
| `order_index` | `int` | `NOT NULL DEFAULT 0` | 排序 |
| `created_at` | `timestamptz` | `DEFAULT now()` | 添加时间 |
| **PK** | `(album_id, song_id)` | 复合主键 | 防止重复关联 |

#### `lyrics` 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | 歌词唯一标识 |
| `user_id` | `uuid` | `NOT NULL REFERENCES auth.users(id)` | 所有者 |
| `title` | `text` | `NOT NULL` | 歌词标题 |
| `content` | `text` | `NOT NULL` | 歌词内容 |
| `language` | `text` | nullable | 语言 |
| `style` | `text` | nullable | 风格标签 |
| `mood` | `text` | nullable | 情绪标签 |
| `source` | `text` | `NOT NULL DEFAULT 'manual'` | `ai_generated`/`manual` |
| `ai_prompt` | `text` | nullable | AI 生成原始 prompt |
| `status` | `text` | `NOT NULL DEFAULT 'draft'` | `draft`/`published` |
| `created_at` | `timestamptz` | `DEFAULT now()` | 创建时间 |
| `updated_at` | `timestamptz` | `DEFAULT now()` | 更新时间 |

### 迁移文件规划

按依赖顺序拆分为 3 个迁移文件：

| 顺序 | 文件名 | 内容 | 依赖 |
|------|--------|------|------|
| 1 | `20260507120001_create_songs.sql` | `songs` 表 + 触发器 + RLS | `auth.users` |
| 2 | `20260507120002_create_albums_and_album_songs.sql` | `albums` + `album_songs` + 触发器 + RLS | `songs` |
| 3 | `20260507120003_create_lyrics.sql` | `lyrics` 表 + 触发器 + RLS | 无 |

每个迁移文件内部结构统一为：
1. 创建表（含字段、约束、默认值）
2. 创建复合主键 / 外键
3. 启用 RLS
4. 创建 RLS 策略
5. 创建 `updated_at` 自动更新触发器

### RLS 策略

- **`songs`**：`user_id = auth.uid()`，ALL 操作
- **`albums`**：`user_id = auth.uid()`，SELECT/INSERT/UPDATE/DELETE
- **`album_songs`**：通过子查询 `album_id IN (SELECT id FROM albums WHERE user_id = auth.uid())` 控制，ALL 操作
- **`lyrics`**：`user_id = auth.uid()`，SELECT/INSERT/UPDATE/DELETE

### TypeScript 类型生成

- 命令：`pnpm supabase:gen:types`
- 导出：`packages/supabase/src/index.ts` 统一导出 `Database` 类型
- 消费：`apps/web` 通过 `@kiyo/supabase` 引用表行/插入/枚举类型

## 影响与风险

| 风险点 | 影响 | 缓解措施 |
|--------|------|----------|
| `songs` 最小结构后续需扩展 | 未来可能需补迁移增加字段 | 本期字段留足扩展空间，title 为 text 无长度限制 |
| `album_songs` 子查询 RLS 性能 | 大数据量时子查询可能有性能开销 | 当前用户级数据量可控，后续可建索引优化 |
| 本地与远程 schema 不一致 | 类型定义基于本地生成 | 迁移文件是真理源，远程通过迁移同步 |

## 验收标准

- [ ] `pnpm supabase:db:reset` 后，四张表结构正确
- [ ] 所有表均启用 RLS，策略按定义生效
- [ ] `updated_at` 触发器工作正常（UPDATE 时自动更新）
- [ ] `packages/supabase/src/database.types.ts` 生成成功，可被 `apps/web` 和 `@kiyo/supabase` 正常引用
- [ ] 迁移文件命名符合 `YYYYMMDDHHMMSS_description.sql` 规范
