# Issue #75 设计：歌词删除时检查关联歌曲

## 1. 背景

**问题**：当歌曲关联的歌词被删除时，当前使用 `ON DELETE SET NULL` 外键行为，导致：
- 歌曲突然失去歌词关联，但用户可能不知道
- 基于歌词生成的歌曲在歌词删除后变成「无词歌曲」
- 歌曲详情页显示「需要关联歌词后才能生成音乐」，但歌曲其实已经生成过了

**目标**：删除歌词前检查是否有歌曲关联，如有则阻止删除并提示用户。

## 2. 方案选择

**选择：A. 后端检查 + 409 错误（静默阻止 + Toast 提示）**

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. 后端检查 + 409 | 实现简单、后端统一验证、前后端解耦 | 需前端处理 409 状态 |
| B. 前端预检查 + 确认弹窗 | 用户体验更友好 | 多一次 API 调用、前端逻辑复杂 |

## 3. API 变更

### DELETE `/api/lyrics/[id]`

**请求**：无变化

**响应**：

| 情况 | HTTP Status | body |
|------|-------------|------|
| 成功删除 | 200 | `{ success: true }` |
| 未认证 | 401 | `{ error: { code: 'UNAUTHORIZED', message: '...' } }` |
| 歌词不存在 | 404 | `{ error: { code: 'NOT_FOUND', message: '...' } }` |
| **有关联歌曲（新增）** | **409** | `{ error: { code: 'LYRIC_IN_USE', message: '该歌词已被 X 首歌曲使用，请先解除关联或删除相关歌曲。', linkedSongCount: X } }` |
| 服务器错误 | 500 | `{ error: { code: 'INTERNAL_ERROR', message: '...' } }` |

### 错误码定义

| code | 说明 |
|------|------|
| `LYRIC_IN_USE` | 歌词被 1+ 首歌曲引用，不可删除 |

## 4. 实现细节

### 4.1 后端变更 (`route.ts`)

在 DELETE handler 中，删除前增加 songs 表关联检查：

```typescript
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  // ... 认证检查 ...

  const { data: existing } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
      { status: 404 }
    )
  }

  // 【新增】检查是否有歌曲关联
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

  // ... 原有的删除逻辑 ...
}
```

### 4.2 测试变更 (`route.test.ts`)

新增测试用例：

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

### 4.3 前端处理

前端（调用方）收到 409 状态码时，显示 Toast 提示：

```
该歌词已被 X 首歌曲使用，请先解除关联或删除相关歌曲。
```

具体前端实现不在本设计范围内，前端组件需自行处理 409 错误。

## 5. 数据库变更

无需变更。现有的 `ON DELETE SET NULL` 外键约束保留，仅通过应用层逻辑增加删除前的检查。

## 6. 影响分析

| 影响点 | 说明 |
|--------|------|
| 现有 lyrics 列表页 | 需处理 409 错误并显示 toast |
| API 调用方 | 需处理新的 409 响应码 |
| 其他模块 | 无 |

## 7. 验收标准

1. ✅ 调用 DELETE `/api/lyrics/[id]` 时，如果存在关联歌曲，返回 409
2. ✅ 错误消息包含被引用的歌曲数量
3. ✅ 如果没有关联歌曲，正常删除（行为不变）
4. ✅ 单元测试覆盖新逻辑
5. ✅ `pnpm type-check` 通过
6. ✅ `pnpm test` 通过

## 8. 后续迭代（可选）

- 方案 B：前端预检查 + 确认弹窗，列出关联歌曲列表让用户选择
- 歌曲详情页增加「歌词来源」提示，告知用户歌词是否已被删除
