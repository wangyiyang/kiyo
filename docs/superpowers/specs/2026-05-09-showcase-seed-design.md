# Showcase Seed 数据生成设计文档

## 目的

将落地页 `/` 的 Showcase 区块从静态假数据替换为真实 AI 生成作品。通过批量调用 Minimax API 生成 100 首歌曲 + 50 张配图，写入数据库并标记精选，供匿名用户浏览。

## 背景

- Issue #73: Showcase 组件硬编码 6 个假 track，公测时损害产品信任度
- 项目已有 Minimax 封装（`packages/ai`），支持歌词生成、歌曲生成、文生图
- 需要补充真实样片，同时验证批量 AI 生成流程的可靠性

## 方案概述

**方案 A：全自动化流水线**

单脚本完成：生成 Prompts → 调用 Minimax → 轮询状态 → 生成封面 → 写入数据库 → 标记精选。

## 架构

```
scripts/seed-showcase/
├── prompts/
│   └── track-prompts.ts          # 100 首预定义 prompts（10 genre × 10 首）
├── generators/
│   ├── generate-lyrics.ts        # 批量生成歌词（30首）
│   ├── generate-songs.ts         # 批量生成歌曲（100首）
│   ├── generate-covers.ts        # 批量生成封面（50张）
│   └── index.ts                  # 编排执行顺序
├── writers/
│   └── seed-database.ts          # 写入 Supabase
├── types.ts                      # 内部类型
├── config.ts                     # 限流、重试、批次配置
└── run.ts                        # 入口：pnpm seed:showcase
```

## 执行 DAG

```
Phase 1: 生成歌词（30首）──┐
                           ├──→ Phase 3: 轮询歌曲状态（100首）
Phase 2: 生成歌曲（100首）──┘         │
                                      ↓
                          Phase 4: 生成封面（50张）
                                      │
                                      ↓
                          Phase 5: 写入数据库
```

## 数据结构

### Prompt 结构

```ts
interface TrackPrompt {
  id: number           // 1-100
  albumIndex: number   // 0-9
  title: string        // 歌曲标题
  prompt: string       // 英文 Minimax 音乐 prompt
  genre: string
  mood: string
  hasLyrics: boolean
  isFeatured: boolean  // 每张专辑前 2 首
  bpm?: number
}

interface AlbumPrompt {
  index: number
  title: string
  genre: string
  description: string  // 专辑封面文生图 prompt
}
```

### 专辑与歌曲分配

| 专辑 # | Genre | 纯音乐 | 带歌词 | 精选 |
|--------|-------|--------|--------|------|
| 1 | Pop & Dance | 7 | 3 | 2 |
| 2 | Rock & Alt | 7 | 3 | 2 |
| 3 | R&B/Soul/Funk | 7 | 3 | 2 |
| 4 | Hip-Hop | 7 | 3 | 2 |
| 5 | Electronic | 7 | 3 | 2 |
| 6 | Folk/Acoustic | 7 | 3 | 2 |
| 7 | Jazz/Blues | 7 | 3 | 2 |
| 8 | Classical | 7 | 3 | 2 |
| 9 | World | 7 | 3 | 2 |
| 10 | 混合/跨界 | 7 | 3 | 2 |
| **合计** | | **70** | **30** | **20** |

### 封面分配

- 10 张专辑封面（基于专辑主题）
- 40 张歌曲封面（每张专辑 4 首，优先精选歌曲）

## API 限流配置

```ts
const RATE_LIMITS = {
  lyrics: { rpm: 3, rpd: 100 },
  songs: { rpm: 3, rpd: 100 },
  covers: { rpm: 5, rpd: 200 },
  pollIntervalMs: 30000,
  maxPollAttempts: 60,
}
```

## 失败重试

| 失败类型 | 策略 |
|---------|------|
| 429 限流 | 指数退避，最多 5 次 |
| 5xx | 立即重试，最多 3 次 |
| 歌曲生成超时（30min） | 标记 `failed`，跳过继续 |
| 封面生成失败 | fallback 纯色渐变 |
| 数据库写入失败 | 事务回滚，输出待写入 JSON |

## 断点续跑

脚本在磁盘维护 `seed-progress.json`：

```json
{
  "phase": "song-polling",
  "completed": 67,
  "failed": [12, 45],
  "pending": [68, 69, 70],
  "results": { "1": { "audioUrl": "...", "coverUrl": "..." } }
}
```

中断后重跑自动恢复。

## 数据库变更

### 新增字段

```sql
alter table songs add column if not exists is_featured boolean default false;
alter table songs add column if not exists genre text;
alter table songs add column if not exists mood text;
alter table songs add column if not exists duration_seconds integer;
```

### RLS 策略扩展

```sql
create policy "anon_read_featured_songs"
  on songs for select
  to anon
  using (is_featured = true);

create policy "anon_read_featured_albums"
  on albums for select
  to anon
  using (id in (
    select distinct album_id from album_songs
    where song_id in (select id from songs where is_featured = true)
  ));
```

## 用户归属

- 创建系统用户 `seed@kiyo.app`
- 所有 seed 数据归属该系统用户
- 匿名用户通过 RLS 策略只读精选内容

## Showcase 组件改造

```tsx
// Server Component
const featured = await supabase
  .from('songs')
  .select('*, albums(title)')
  .eq('is_featured', true)
  .limit(6)

if (!featured?.length) return null
```

- 无精选数据时隐藏整个区块（兜底）
- 标题直接展示英文，不走 i18n key（seed 数据的 prompt 是英文的）

## i18n 策略

- Seed 数据统一使用英文标题和描述
- 公测阶段英文标题可直接展示，后续如需中文可追加翻译任务
- Prompt 严格使用英文（Minimax API 对英文 prompt 响应最佳）

## 风险与应对

| 风险 | 应对 |
|------|------|
| Minimax API 额度不足 | 脚本支持断点续跑，可分批执行 |
| 生成质量参差不齐 | 30首带歌词优先投入精品 prompt，70首纯音乐可用标准模板 |
| 数据库写入后无法回滚 | 写入前输出完整 JSON 备份，脚本支持 `—dry-run` |
| 批量生成耗时过长 | 限流可控，可夜间跑，断点续跑不丢进度 |

## 验收标准

- [ ] 脚本可完整执行或断点续跑，生成 100 首歌 + 50 张封面
- [ ] 数据库中 `is_featured = true` 的歌曲 ≥ 12 首（Showcase 需要 6 首 + 冗余）
- [ ] 落地页 Showcase 区块展示真实作品，无静态假数据
- [ ] 匿名用户可正常浏览精选歌曲和专辑
- [ ] 脚本支持 `—dry-run` 模式，不调用 API 只输出计划
