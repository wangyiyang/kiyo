# Issue #199 探索页面标签与封面质量修复 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复探索页面标签中英文混排、复合标签问题，以及封面图渲染/加载失败导致的占位符问题。

**Architecture:** 采用三层防护：数据库 migration 清洗历史脏数据 + API 入口标准化新数据 + 前端展示层兜底映射。封面问题通过运行时 `onError` fallback 和种子脚本 prompt 优化解决。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase, Vitest, pnpm monorepo (Turborepo)

---

### Task 1: 标签标准化工具模块

**Files:**
- Create: `apps/web/src/lib/tag-normalization.ts`
- Test: `apps/web/src/lib/tag-normalization.test.ts`

- [ ] **Step 1: 编写 tag-normalization 模块**

```typescript
// apps/web/src/lib/tag-normalization.ts

/**
 * 已知的中文标签到英文的映射表
 * 键为原始输入（小写、去空格后），值为标准化后的英文标签
 */
const TAG_MAPPINGS: Record<string, string> = {
  '伤感': 'sentimental',
  '流行': 'pop',
  '悲伤': 'melancholic',
  '快乐': 'happy',
  '兴奋': 'energetic',
  '安静': 'peaceful',
  '温柔': 'warm',
}

/**
 * 标准化单个标签：
 * 1. 空值保护
 * 2. 去前后空格
 * 3. 转为小写
 * 4. 中文映射到英文
 * 5. 复合标签（含逗号）：保留第一个最具体的子标签
 * 6. 去除多余空格
 */
export function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== 'string') return null

  let normalized = tag.trim().toLowerCase()

  // 中文映射
  if (TAG_MAPPINGS[normalized]) {
    return TAG_MAPPINGS[normalized]
  }

  // 复合标签处理：逗号分隔时保留第一部分
  if (normalized.includes(',')) {
    normalized = normalized.split(',')[0].trim()
  }

  // 去除多余空格
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized || null
}

/**
 * 批量标准化标签数组，过滤空值和重复值
 */
export function normalizeTagList(tags: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const tag of tags) {
    const normalized = normalizeTag(tag)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  return result
}
```

- [ ] **Step 2: 编写单元测试**

```typescript
// apps/web/src/lib/tag-normalization.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeTag, normalizeTagList } from './tag-normalization'

describe('normalizeTag', () => {
  it('returns null for empty/whitespace input', () => {
    expect(normalizeTag(null)).toBeNull()
    expect(normalizeTag(undefined)).toBeNull()
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('   ')).toBeNull()
  })

  it('trims and lowercases tags', () => {
    expect(normalizeTag('  Melancholic  ')).toBe('melancholic')
    expect(normalizeTag('Energetic')).toBe('energetic')
  })

  it('maps Chinese tags to English', () => {
    expect(normalizeTag('伤感')).toBe('sentimental')
    expect(normalizeTag('流行')).toBe('pop')
    expect(normalizeTag('  伤感  ')).toBe('sentimental')
  })

  it('splits compound tags on comma keeping first part', () => {
    expect(normalizeTag('electropop, bright, short')).toBe('electropop')
    expect(normalizeTag('  Pop, Dance, Electronic  ')).toBe('pop')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeTag('dreamy   pop')).toBe('dreamy pop')
  })
})

describe('normalizeTagList', () => {
  it('filters nulls and deduplicates', () => {
    expect(normalizeTagList(['伤感', '流行', null, '伤感'])).toEqual([
      'sentimental',
      'pop',
    ])
  })

  it('returns empty array for all invalid input', () => {
    expect(normalizeTagList([null, undefined, ''])).toEqual([])
  })
})
```

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm --filter web test -- apps/web/src/lib/tag-normalization.test.ts`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/tag-normalization.ts apps/web/src/lib/tag-normalization.test.ts
git commit -m "feat(tags): add tag normalization utility with tests"
```

---

### Task 2: 探索页面标签展示标准化

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/explore/page.tsx`

- [ ] **Step 1: 修改 explore 页面，导入并使用标签标准化**

在文件顶部添加导入：
```typescript
import { normalizeTag, normalizeTagList } from '@/lib/tag-normalization'
```

将 `genres` 和 `moods` 的提取逻辑改为：
```typescript
  const rawGenres = Array.from(
    new Set(allSongs?.map((s) => s.genre).filter(Boolean) as string[])
  ).sort()

  const rawMoods = Array.from(
    new Set(allSongs?.map((s) => s.mood).filter(Boolean) as string[])
  ).sort()

  const genres = normalizeTagList(rawGenres)
  const moods = normalizeTagList(rawMoods)
```

修改 `buildUrl` 中对 genre/mood 的使用保持不变（因为标准化后的标签已经干净）。

- [ ] **Step 2: 确认类型检查通过**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/(site)/explore/page.tsx
git commit -m "fix(explore): normalize tag lists before rendering filters"
```

---

### Task 3: 歌曲生成 API 入口标准化

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`

- [ ] **Step 1: 在歌曲生成 API 中标准化 genre 和 mood**

在文件顶部添加导入：
```typescript
import { normalizeTag } from '@/lib/tag-normalization'
```

在 `insert` 语句前，将 genre 和 mood 标准化：
```typescript
  const normalizedGenre = normalizeTag(typeof genre === 'string' ? genre : null)
  const normalizedMood = normalizeTag(typeof mood === 'string' ? mood : null)
```

将 insert 中的 `genre` 和 `mood` 字段改为使用标准化后的值：
```typescript
      genre: normalizedGenre,
      mood: normalizedMood,
```

同时更新 task payload 中的 genre 和 mood：
```typescript
        genre: normalizedGenre,
        mood: normalizedMood,
```

- [ ] **Step 2: 运行相关测试**

Run: `pnpm --filter web test -- apps/web/src/app/api/songs/generate/route.test.ts`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/generate/route.ts
git commit -m "fix(api): normalize genre/mood before saving new songs"
```

---

### Task 4: ShowcaseCard 封面加载失败降级

**Files:**
- Modify: `apps/web/src/components/sections/showcase-card.tsx`

- [ ] **Step 1: 给 Image 组件增加 onError fallback**

找到 `coverUrl ? (...)` 处的 `Image` 组件，添加 `onError` 处理：

```tsx
        <Image
          src={coverUrl}
          alt={track.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={() => setCoverUrl(null)}
        />
```

这样当图片加载失败（404/500/格式错误等）时，`coverUrl` 会被设为 `null`，自动回退到下面的 gradient fallback div。

- [ ] **Step 2: 确认类型检查通过**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/showcase-card.tsx
git commit -m "fix(ui): fallback to gradient on cover image load failure"
```

---

### Task 5: ShowcaseCard 标签展示标准化

**Files:**
- Modify: `apps/web/src/components/sections/showcase-card.tsx`

- [ ] **Step 1: 导入并使用标签标准化**

在文件顶部添加导入：
```typescript
import { normalizeTag } from '@/lib/tag-normalization'
```

修改展示 `track.genre` 和 `track.mood` 的地方：

找到：
```tsx
        <p className="text-xs uppercase tracking-wider opacity-80">
          {track.genre ?? tExplore('defaultGenre')}
        </p>
```
改为：
```tsx
        <p className="text-xs uppercase tracking-wider opacity-80">
          {normalizeTag(track.genre) ?? tExplore('defaultGenre')}
        </p>
```

找到：
```tsx
        <p className="mt-1 text-xs opacity-75">
          {track.mood ?? tExplore('defaultMood')} · {formatDuration(track.duration)}
        </p>
```
改为：
```tsx
        <p className="mt-1 text-xs opacity-75">
          {normalizeTag(track.mood) ?? tExplore('defaultMood')} · {formatDuration(track.duration)}
        </p>
```

- [ ] **Step 2: 确认类型检查通过**

Run: `pnpm --filter web type-check`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/sections/showcase-card.tsx
git commit -m "fix(ui): normalize genre/mood display in showcase cards"
```

---

### Task 6: 数据库 Migration 清洗历史标签数据

**Files:**
- Create: `supabase-local/migrations/20260514000000_normalize_song_tags.sql`

- [ ] **Step 1: 编写数据清洗 migration**

```sql
-- 清洗 songs 表中的 genre 和 mood 字段
-- 策略：
-- 1. 去前后空格，转小写
-- 2. 中文标签映射到英文
-- 3. 复合标签（含逗号）保留第一部分

-- 先创建一个辅助函数用于标签标准化
CREATE OR REPLACE FUNCTION normalize_song_tag(tag text)
RETURNS text AS $$
DECLARE
  cleaned text;
  mapped text;
BEGIN
  IF tag IS NULL OR trim(tag) = '' THEN
    RETURN NULL;
  END IF;

  -- 去空格转小写
  cleaned := lower(trim(tag));

  -- 中文映射
  CASE cleaned
    WHEN '伤感' THEN RETURN 'sentimental';
    WHEN '流行' THEN RETURN 'pop';
    WHEN '悲伤' THEN RETURN 'melancholic';
    WHEN '快乐' THEN RETURN 'happy';
    WHEN '兴奋' THEN RETURN 'energetic';
    WHEN '安静' THEN RETURN 'peaceful';
    WHEN '温柔' THEN RETURN 'warm';
    ELSE NULL;
  END CASE;

  -- 复合标签处理：保留逗号前第一部分
  IF position(',' in cleaned) > 0 THEN
    cleaned := trim(split_part(cleaned, ',', 1));
  END IF;

  -- 去除多余空格
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- 更新 genre 字段
UPDATE songs
SET genre = normalize_song_tag(genre)
WHERE genre IS NOT NULL;

-- 更新 mood 字段
UPDATE songs
SET mood = normalize_song_tag(mood)
WHERE mood IS NOT NULL;

-- 清理辅助函数（migration 完成后不再需要）
DROP FUNCTION IF EXISTS normalize_song_tag(text);
```

**注意**：上面的 PL/pgSQL 函数中使用 `CASE` 会提前 return，所以在 `ELSE` 中不应该直接返回 NULL。让我修正这个逻辑：

```sql
CREATE OR REPLACE FUNCTION normalize_song_tag(tag text)
RETURNS text AS $$
DECLARE
  cleaned text;
BEGIN
  IF tag IS NULL OR trim(tag) = '' THEN
    RETURN NULL;
  END IF;

  -- 去空格转小写
  cleaned := lower(trim(tag));

  -- 中文映射
  IF cleaned = '伤感' THEN RETURN 'sentimental'; END IF;
  IF cleaned = '流行' THEN RETURN 'pop'; END IF;
  IF cleaned = '悲伤' THEN RETURN 'melancholic'; END IF;
  IF cleaned = '快乐' THEN RETURN 'happy'; END IF;
  IF cleaned = '兴奋' THEN RETURN 'energetic'; END IF;
  IF cleaned = '安静' THEN RETURN 'peaceful'; END IF;
  IF cleaned = '温柔' THEN RETURN 'warm'; END IF;

  -- 复合标签处理：保留逗号前第一部分
  IF position(',' in cleaned) > 0 THEN
    cleaned := trim(split_part(cleaned, ',', 1));
  END IF;

  -- 去除多余空格
  cleaned := regexp_replace(cleaned, '\s+', ' ', 'g');

  RETURN cleaned;
END;
$$ LANGUAGE plpgsql;

-- 更新 genre 字段
UPDATE songs
SET genre = normalize_song_tag(genre)
WHERE genre IS NOT NULL;

-- 更新 mood 字段
UPDATE songs
SET mood = normalize_song_tag(mood)
WHERE mood IS NOT NULL;

-- 清理辅助函数
DROP FUNCTION IF EXISTS normalize_song_tag(text);
```

- [ ] **Step 2: Commit**

```bash
git add supabase-local/migrations/20260514000000_normalize_song_tags.sql
git commit -m "feat(db): add migration to normalize historical song tags"
```

---

### Task 7: 种子脚本封面生成 Prompt 优化

**Files:**
- Modify: `scripts/seed-showcase/generators/covers.ts`

- [ ] **Step 1: 强化封面 prompt 约束并移除标题引用**

找到 `buildSongCoverPrompt` 函数：

```typescript
function buildSongCoverPrompt(track: TrackPrompt): string {
  return `Music cover art for a ${track.mood} ${track.genre} track titled "${track.title}". Abstract, artistic, high quality, no text.`
}
```

改为：

```typescript
function buildSongCoverPrompt(track: TrackPrompt): string {
  return `Music cover art for a ${track.mood} ${track.genre} track. Abstract, artistic, high quality, no text, no letters, no words, no typography, no symbols.`
}
```

改动说明：
- 移除 `"${track.title}"` 引用，避免标题中的特殊字符诱导 AI 生成文字
- 增加 `"no letters, no words, no typography, no symbols"` 多重约束

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-showcase/generators/covers.ts
git commit -m "chore(seed): strengthen cover generation prompt to avoid text artifacts"
```

---

### Task 8: 最终验证

- [ ] **Step 1: 运行全量类型检查**

Run: `pnpm type-check`
Expected: 全 workspace 无错误

- [ ] **Step 2: 运行 web 测试**

Run: `pnpm --filter web test`
Expected: 全部通过

- [ ] **Step 3: 运行 lint**

Run: `pnpm lint`
Expected: 无错误

---

## Self-Review

### Spec Coverage Check

| 设计文档要求 | 实现任务 |
|---|---|
| 数据库 migration 清洗历史数据 | Task 6 ✅ |
| API 入口标准化新数据 | Task 3 ✅ |
| 前端展示层兜底映射 | Task 2, Task 5 ✅ |
| 封面 onError fallback | Task 4 ✅ |
| 种子脚本 prompt 优化 | Task 7 ✅ |
| 标签标准化工具 + 测试 | Task 1 ✅ |

### Placeholder Scan

- 无 TBD/TODO
- 无 "add appropriate error handling" 类模糊描述
- 每个代码步骤都包含完整代码
- 无 "similar to Task N" 引用

### Type Consistency Check

- `normalizeTag` 签名一致：`tag: string | null | undefined => string | null`
- `normalizeTagList` 签名一致：`(string | null | undefined)[] => string[]`
- 函数名在所有任务中统一为 `normalizeTag` / `normalizeTagList`
