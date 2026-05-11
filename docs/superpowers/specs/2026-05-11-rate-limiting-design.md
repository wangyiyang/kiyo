# Rate Limiting 设计文档

> Issue: #66  
> 日期: 2026-05-11  
> 作者: AI Agent  
> 状态: 已实现

## 背景与目标

Kiyo 的 AI 生成类 API（歌词生成、歌曲生成、封面生成等）调用成本较高，且当前没有任何服务端限流机制。用户可无限次调用这些接口，存在被恶意滥用的风险。

本设计目标：
- 为所有 AI 生成类 API 添加滑动窗口速率限制
- 防止用户/访客在短时间内大量消耗 AI 资源
- 保持实现简洁，不引入额外外部依赖

## 设计决策

### 1. 覆盖范围

仅对 **AI 生成类 API** 进行限流，不包括普通的 CRUD 操作。

| 动作类型 | 端点 | 说明 |
|---------|------|------|
| `lyrics_generate` | `POST /api/lyrics/generate` | AI 生成歌词 |
| `song_generate` | `POST /api/songs/generate` | 异步创建歌曲生成任务 |
| `song_generate` | `POST /api/songs/:id/generate` | 歌曲重新生成 |
| `cover_generate` | `POST /api/songs/cover` | AI 翻唱 |
| `image_generate` | `POST /api/songs/:id/cover?action=generate` | 歌曲封面生成 |
| `image_generate` | `POST /api/albums/:id/cover?action=generate` | 专辑封面生成 |
| `task_retry` | `POST /api/tasks/retry` | 失败任务重试 |

> 注：封面/专辑封面的 `action=upload`（手动上传）不限流，仅 `action=generate`（AI 生成）限流。

### 2. 限流维度

采用 **用户 ID + IP 地址** 双重维度：

- **已登录用户**：`user:{user_id}` — 按用户独立计数
- **未登录用户**：`ip:{client_ip}` — 按 IP 地址计数

IP 提取优先级：`X-Forwarded-For` → `X-Real-IP` → `unknown`

### 3. 限流算法

**滑动窗口计数器**（Sliding Window Counter）：

1. 每次请求时删除窗口期外的旧记录
2. 统计当前窗口内该 key + action 的请求次数
3. 若未超限，插入新记录并允许请求
4. 若已超限，返回 429 拒绝请求

相比固定窗口，滑动窗口避免了窗口边界处的突发流量问题。

### 4. 限流阈值

| 动作类型 | 时间窗口 | 最大请求次数 |
|---------|---------|------------|
| `lyrics_generate` | 1 小时 | 10 次 |
| `song_generate` | 1 小时 | 5 次 |
| `cover_generate` | 1 小时 | 5 次 |
| `image_generate` | 1 小时 | 10 次 |
| `task_retry` | 1 小时 | 10 次 |

阈值基于以下考量：
- 歌词生成相对轻量，允许更多次数
- 歌曲生成（音乐/翻唱）耗时较长且成本高，限制更严格
- 封面生成（图片）成本适中
- 任务重试不应过于频繁

### 5. 存储层

使用 **Supabase PostgreSQL**，不引入 Redis 等额外依赖：

- 表：`rate_limits`
- 字段：`key`, `action`, `created_at`
- 索引：`(key, action, created_at)` 复合索引 + `(created_at)` 清理索引
- RLS：禁止客户端直接访问，仅服务端通过 `service_role` 或 server-side client 操作

选择 PostgreSQL 的原因：
- 零额外依赖，与现有架构一致
- AI 生成不是高频操作，PostgreSQL 性能完全够用
- 便于与现有测试基础设施（mock Supabase client）集成

## 数据模型

```sql
create table rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,           -- "user:{id}" 或 "ip:{address}"
  action text not null,        -- 限流动作类型
  created_at timestamptz default now()
);

create index idx_rate_limits_key_action_created
  on rate_limits (key, action, created_at);

create index idx_rate_limits_created_at
  on rate_limits (created_at);

-- action 取值约束
alter table rate_limits
  add constraint rate_limits_action_check
  check (action in (
    'lyrics_generate',
    'song_generate',
    'cover_generate',
    'image_generate',
    'task_retry'
  ));
```

## API 响应

### 限流通过（正常响应）

返回原始业务响应，HTTP 状态码不变。

响应头包含限流信息（可选，由客户端读取）：
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 3600
```

### 限流触发（429 Too Many Requests）

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Limit: 10 requests per hour. Please try again after 3600 seconds."
  }
}
```

响应头：
```
Retry-After: 3600
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 3600
```

## 代码结构

```
apps/web/src/lib/rate-limit.ts          # 限流核心模块
apps/web/src/lib/rate-limit.test.ts     # 单元测试
```

### 核心 API

```typescript
// 检查限流
const result = await checkRateLimit('lyrics_generate', user.id, request)
if (!result.allowed) {
  return createRateLimitResponse(result)
}

// 自定义配置（覆盖默认值）
const result = await checkRateLimit('lyrics_generate', user.id, request, {
  windowMs: 60000,    // 1 分钟
  maxRequests: 2,     // 最多 2 次
})
```

## 集成方式

在每个 AI 生成 API 路由的认证检查之后、业务逻辑之前插入限流检查：

```typescript
export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  // === 限流检查 ===
  const rateLimit = await checkRateLimit('lyrics_generate', user.id, request)
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit)
  }

  // ... 原有业务逻辑
}
```

## 故障安全

- **清理失败**：仅记录 warn，不影响主逻辑
- **计数查询失败**：出于安全考虑，默认拒绝请求（`allowed: false`）
- **插入记录失败**：出于安全考虑，默认拒绝请求

## 测试覆盖

| 测试场景 | 状态 |
|---------|------|
| 未达限流阈值，允许请求 | ✅ |
| 达到限流阈值，拒绝请求 | ✅ |
| 已登录用户使用 user ID 维度 | ✅ |
| 未登录用户使用 IP 维度（X-Forwarded-For） | ✅ |
| 未登录用户回退到 X-Real-IP | ✅ |
| 无 IP 头时回退到 unknown | ✅ |
| 自定义限流配置 | ✅ |
| 数据库查询失败时默认拒绝 | ✅ |
| 429 响应头正确 | ✅ |

## 未来扩展

1. **动态阈值**：根据用户等级（免费/付费）设置不同阈值
2. **Redis 后端**：高并发场景下可替换为 Redis 实现，保持 `checkRateLimit` 接口不变
3. **限流仪表盘**：在管理后台展示各 action 的限流触发率
4. **前端提示**：在 UI 上展示剩余次数和重置时间
5. **IP 白名单**：为内测用户或合作伙伴绕过限流

## 相关文件

- `apps/web/src/lib/rate-limit.ts` — 限流核心模块
- `apps/web/src/lib/rate-limit.test.ts` — 单元测试
- `supabase-local/migrations/20260511180000_create_rate_limits.sql` — 数据库迁移
- `apps/web/src/lib/test-utils.ts` — Mock Supabase Client（支持 rate_limits 表）
