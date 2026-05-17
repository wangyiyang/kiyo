# Issue #199 设计文档：探索页面标签与封面质量修复

## 背景

在第二轮视觉体验测试中发现，探索页面（`/explore`）的风格筛选标签存在中英文混排、格式不统一的问题，且部分歌曲封面图存在渲染质量问题。

## 问题根因分析

### 标签不一致

- 探索页面直接从 `songs` 表的 `genre` 和 `mood` 字段动态读取标签列表
- 种子数据使用预定义英文标签，但**用户生成歌曲时**可以输入任意内容，没有限制
- 因此出现了以下脏数据：
  - 中文标签：`"伤感"`、`"流行"`
  - 复合标签：`"electropop, bright, short"`

### 封面质量问题

- 封面通过 AI 生成，prompt 包含 `"no text"`，但约束不够强
- 部分封面仍有文字渲染问题（模糊或问号占位符）
- 部分歌曲没有封面时，没有优雅降级机制

## 设计方案

采用**数据入口标准化 + 历史数据清洗 + 展示层兜底**的三层防护策略。

### 1. 标签标准化体系

#### 1.1 数据库 Migration（清洗历史数据）

新建 migration `20260514000000_normalize_song_tags.sql`：

- **中文标签映射**：
  - `"伤感"` → `"sentimental"`
  - `"流行"` → `"pop"`
- **复合标签处理**：
  - `"electropop, bright, short"` → `"electropop"`（保留第一个最具体的子标签，逗号后内容丢弃）
- **通用清洗**：
  - 去除前后空格
  - 统一转小写
  - 去除多余空格

对 `songs` 表中所有记录执行清洗。

#### 1.2 数据入口标准化（API 层）

新增 `apps/web/src/lib/tag-normalization.ts`，提供：

```typescript
const TAG_MAPPINGS: Record<string, string> = {
  '伤感': 'sentimental',
  '流行': 'pop',
  // ... 其他已知映射
}

export function normalizeTag(tag: string | null): string | null
```

在以下 API 路由中，**保存到数据库前**调用 `normalizeTag()`：
- `POST /api/songs/generate` — 标准化 `genre` 和 `mood`

这样新创建的歌曲不会再产生脏数据。

#### 1.3 展示层兜底（前端）

修改 `explore/page.tsx`：
- 从数据库读取 `genres` / `moods` 后，用 `normalizeTag()` 再次处理
- 确保即使数据库中有新脏数据，展示层也能保持统一
- 过滤空值和重复项后渲染标签按钮

修改 `ShowcaseCard`：
- 对展示的 `track.genre` 和 `track.mood` 也调用标准化，确保卡片内标签一致

### 2. 封面质量修复

#### 2.1 运行时降级（前端）

修改 `ShowcaseCard`：
- 给 `next/image` 增加 `onError` 处理：当封面 URL 返回 404/500 或加载失败时，将 `coverUrl` 状态设为 `null`
- 自动回退到已有的 gradient fallback，不再显示问号占位符

#### 2.2 封面生成改进（种子脚本）

修改 `scripts/seed-showcase/generators/covers.ts` 中的 `buildSongCoverPrompt()`：
- 强化 `"no text, no letters, no words, no typography"` 约束
- 移除 `track.title` 引用（标题中的特殊字符可能诱导 AI 尝试生成文字）

### 3. 组件与文件变更清单

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `apps/web/src/lib/tag-normalization.ts` | 新增 | 标签标准化工具 + 映射表 |
| `apps/web/src/lib/tag-normalization.test.ts` | 新增 | 单元测试 |
| `supabase-local/migrations/20260514000000_normalize_song_tags.sql` | 新增 | 数据清洗 migration |
| `apps/web/src/app/api/songs/generate/route.ts` | 修改 | 保存前标准化 genre/mood |
| `apps/web/src/app/[locale]/(site)/explore/page.tsx` | 修改 | 展示层标准化标签列表 |
| `apps/web/src/components/sections/showcase-card.tsx` | 修改 | 标签展示标准化 + 封面 onError fallback |
| `scripts/seed-showcase/generators/covers.ts` | 修改 | 改进封面 prompt |

### 4. 验收标准对应

| Issue 验收标准 | 实现方式 |
|---|---|
| 所有标签语言风格统一 | Migration 清洗 + API 入口标准化 + 前端兜底映射 |
| 没有复合标签 | Migration 拆分/截断 + API 入口阻止 |
| 封面无问号占位符 | `Image.onError` → gradient fallback |
| 封面文字清晰 | 强化 prompt `"no text"` 约束 |

## 风险评估

- **Migration 风险**：映射关系如果遗漏了未知的脏数据标签，可能无法完全清洗。解决方案是前端兜底映射。
- **用户体验影响**：用户之前输入的中文标签在保存后会自动转为英文，这符合统一目标，但需要在 UI 上给用户明确的预定义标签选择。

## 后续优化方向（不在本次范围）

- 在歌曲创建表单中，将 genre/mood 改为下拉选择器（Select），而不是自由输入，从源头彻底杜绝脏数据
