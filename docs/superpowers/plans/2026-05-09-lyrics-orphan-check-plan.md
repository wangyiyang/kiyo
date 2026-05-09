# Issue #75 歌词删除孤儿检查实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除歌词前检查是否有歌曲关联，如有则返回 409 错误

**Architecture:** 在 DELETE handler 中增加 songs 表关联检查，返回 LYRIC_IN_USE 错误码

**Tech Stack:** Next.js App Router, Supabase, Vitest

---

## 文件映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `apps/web/src/app/api/lyrics/[id]/route.ts` | 修改 | DELETE handler 增加关联检查 |
| `apps/web/src/app/api/lyrics/[id]/route.test.ts` | 修改 | 新增 409 场景测试 |

---

## Task 1: 修改 DELETE handler 增加关联检查

**Files:**
- Modify: `apps/web/src/app/api/lyrics/[id]/route.ts:130-180`

- [ ] **Step 1: 读取当前 DELETE handler 实现**

读取 `apps/web/src/app/api/lyrics/[id]/route.ts` 第 130-180 行，确认现有 DELETE handler 完整代码

- [ ] **Step 2: 修改 DELETE handler 增加关联检查**

在 `if (!existing)` 检查后、`await supabase.from('lyrics').delete()` 前插入：

```typescript
// 检查是否有歌曲关联该歌词
const { count: linkedCount } = await supabase
  .from('songs')
  .select('id', { count: 'exact' })
  .eq('lyric_id', params.id)

if (linkedCount && linkedCount > 0) {
  return NextResponse.json(
    {
      error: {
        code: 'LYRIC_IN_USE',
        message: `该歌词已被 ${linkedCount} 首歌曲使用，请先解除关联或删除相关歌曲。`,
        linkedSongCount: linkedCount
      }
    },
    { status: 409 }
  )
}
```

- [ ] **Step 3: 运行 type-check 验证类型正确**

Run: `cd /Users/wangyiyang/Documents/Github/kiyo && pnpm type-check`
Expected: 无类型错误

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add apps/web/src/app/api/lyrics/[id]/route.ts
git commit -m "fix(api/lyrics): prevent deletion of lyrics linked to songs"
```

---

## Task 2: 新增测试用例覆盖 409 场景

**Files:**
- Modify: `apps/web/src/app/api/lyrics/[id]/route.test.ts`

- [ ] **Step 1: 读取现有测试文件结构**

确认 `createMockSupabaseClient` 如何模拟 `songs` 数据和 `count` 返回值

- [ ] **Step 2: 新增 409 场景测试**

在 `describe('DELETE /api/lyrics/:id')` 块中新增：

```typescript
it('returns 409 when lyric is linked to songs', async () => {
  const { createServerClient } = await import('@kiyo/supabase/server')
  const mockClient = createMockSupabaseClient({ userId: 'user-1' })
  mockClient.dataStore.lyrics = [
    { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line', source: 'manual', status: 'draft' },
  ]
  mockClient.dataStore.songs = [
    { id: 's1', title: 'Song 1', user_id: 'user-1', lyric_id: 'l1' },
  ]
  vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

  const response = await DELETE(new Request('http://localhost'), { params: { id: 'l1' } })
  expect(response.status).toBe(409)
  const json = await response.json()
  expect(json.error.code).toBe('LYRIC_IN_USE')
  expect(json.error.linkedSongCount).toBe(1)
})
```

- [ ] **Step 3: 运行测试验证**

Run: `cd /Users/wangyiyang/Documents/Github/kiyo && pnpm --filter web test -- apps/web/src/app/api/lyrics/[id]/route.test.ts`
Expected: 所有测试通过，包括新的 409 测试

- [ ] **Step 4: 提交代码**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add apps/web/src/app/api/lyrics/[id]/route.test.ts
git commit -m "test(api/lyrics): add 409 test for lyric deletion with linked songs"
```

---

## Task 3: 全量验证

- [ ] **Step 1: 运行完整测试套件**

Run: `cd /Users/wangyiyang/Documents/Github/kiyo && pnpm test`
Expected: 所有测试通过

- [ ] **Step 2: 运行 lint 检查**

Run: `cd /Users/wangyiyang/Documents/Github/kiyo && pnpm lint`
Expected: 无 lint 错误

- [ ] **Step 3: 提交最终变更**

```bash
cd /Users/wangyiyang/Documents/Github/kiyo
git add -A
git commit -m "feat(lyrics): prevent orphan songs by blocking lyric deletion with links"
```

---

## 验收清单

- [ ] DELETE `/api/lyrics/[id]` 返回 409 当 lyric_id 被 songs 引用
- [ ] 错误消息包含被引用的歌曲数量
- [ ] 无关联歌曲时正常删除（行为不变）
- [ ] `pnpm type-check` 通过
- [ ] `pnpm test` 通过
