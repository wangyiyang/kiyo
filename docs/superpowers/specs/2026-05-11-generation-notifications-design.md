# 生成完成站内通知设计

> 对应 Issue: #71「生成完成后无通知机制（邮件/站内通知）」
> 关联 Issue: #48 AI 作曲异步队列、#49 生成状态轮询

---

## 1. 背景与问题

当前 AI 生成（作曲、翻唱、封面）完成后，用户只有两种感知方式：
1. 一直停留在页面等待轮询（#49）
2. 手动刷新查看状态

没有**主动通知机制**告知用户生成完成或失败，导致用户体验断裂。

---

## 2. 设计目标

1. **实时通知**：用户在线时通过 Supabase Realtime 实时收到通知
2. **离线补偿**：用户离开后再回来，页面加载时拉取未读通知
3. **不阻塞核心流程**：通知创建失败不影响 `generation_tasks` 状态更新
4. **多语言支持**：利用已有 `next-intl` 体系
5. **最小侵入**：不对 Edge Function 做侵入式修改

---

## 3. 架构概览

### 3.1 数据流

```
┌─────────────────┐     POST /api/songs/generate     ┌─────────────────┐
│     用户前端     │ ────────────────────────────────> │   Next.js API   │
│  (Header 铃铛)   │                                   │                 │
└─────────────────┘                                   └─────────────────┘
         │                                                      │
         │  Realtime INSERT 广播                                  │
         │ <──────────────────────────────────────────────────────┤
         │                                                      │
         │  1. 创建 song 记录                                      │
         │  2. 创建 generation_tasks 记录                           │
         │  3. 同步 INSERT notifications (started)                  │
         │                                                      │
         │              pg_cron 每分钟触发                         │
         │              POST Edge Function                         │
         │              process-generation-task                     │
         └──────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Edge Function 更新 task 状态    │
                    │ UPDATE generation_tasks        │
                    │ SET status = 'completed'       │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ 数据库触发器自动创建通知        │
                    │ INSERT notifications            │
                    │ (completed / failed)            │
                    └───────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │ Supabase Realtime 广播 INSERT   │
                    │ 前端收到后更新铃铛未读计数       │
                    └───────────────────────────────┘
```

### 3.2 核心组件

| 组件 | 职责 | 技术栈 |
|------|------|--------|
| `notifications` 表 | 存储所有站内通知 | PostgreSQL |
| `handle_task_notification()` | `generation_tasks` UPDATE 时自动创建通知 | PL/pgSQL 触发器 |
| `POST /api/songs/generate` | 创建 song + task + notification(started) | Next.js API Route |
| `GET /api/notifications` | 拉取用户通知列表 | Next.js API Route |
| `PATCH /api/notifications/:id/read` | 单条标记已读 | Next.js API Route |
| `PATCH /api/notifications/read-all` | 批量标记已读 | Next.js API Route |
| `NotificationBell` | Header 铃铛图标 + 未读计数 | React Component |
| `NotificationPanel` | 下拉通知列表 + 全部已读按钮 | React Component |
| `useNotifications` | Realtime 订阅 + 查询 + 状态管理 | React Hook |

---

## 4. 数据库设计

### 4.1 notifications 表

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  -- 关联业务对象（nullable，关联数据可能已删除）
  song_id uuid references songs(id) on delete set null,
  album_id uuid references albums(id) on delete set null,

  -- 通知分类
  type text not null,        -- 'generation'（预留扩展：'comment', 'system'）
  subtype text not null,     -- 'started' | 'completed' | 'failed'

  -- 国际化模板
  template_key text not null,   -- e.g. 'notification.generation.completed'
  template_params jsonb not null default '{}',

  -- 阅读状态
  is_read boolean not null default false,

  -- 跳转目标（可选，前端决定默认行为）
  target_url text,

  -- 时间戳
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 检查约束
alter table notifications
  add constraint notifications_type_check
  check (type in ('generation'));

alter table notifications
  add constraint notifications_subtype_check
  check (subtype in ('started', 'completed', 'failed'));

-- 索引：快速查未读 + 按时间排序
create index idx_notifications_user_unread
  on notifications (user_id, created_at desc)
  where is_read = false;

create index idx_notifications_user
  on notifications (user_id, created_at desc);

-- RLS：用户只能看自己的通知
alter table notifications enable row level security;

create policy "notifications_user_select"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications_user_update"
  on notifications for update to authenticated
  using (user_id = auth.uid());

-- updated_at 自动更新
create trigger update_notifications_updated_at
  before update on notifications
  for each row
  execute function moddatetime('updated_at');
```

**字段说明：**

| 字段 | 说明 |
|------|------|
| `type` | 通知大类：`generation`（AI 生成相关） |
| `subtype` | 子类型：`started`（开始生成）、`completed`（完成）、`failed`（失败） |
| `template_key` | next-intl 翻译 key，如 `notification.generation.completed` |
| `template_params` | 模板参数，如 `{"songTitle": "夏日微风"}` |
| `song_id/album_id` | 关联业务对象，删除后自动设为 NULL，通知仍可显示 |

**设计决策：**
- `song_id/album_id` 使用 `on delete set null`：歌曲被删除后通知仍保留，只是失去关联
- `template_key` + `template_params`：支持 i18n，数据自包含
- 不存 `lyric_id`：歌词生成没有独立的详情页，通知统一导向歌曲页
- `target_url` 当前为 NULL，由前端根据 `song_id` 动态构建跳转 URL

### 4.2 触发器：task 状态变化 → 通知

```sql
create or replace function handle_task_notification()
returns trigger as $$
declare
  v_title text;
begin
  -- 包裹在异常处理中：通知创建失败不阻塞任务状态更新
  begin
    -- 只处理 music/cover 类型的 completed/failed（album_cover 暂不需要通知）
    if new.type not in ('music', 'cover') then
      return new;
    end if;

    -- 获取歌曲标题
    if new.song_id is not null then
      select title into v_title from songs where id = new.song_id;
    end if;

    -- 任务完成
    if new.status = 'completed' and old.status <> 'completed' then
      insert into notifications (user_id, song_id, type, subtype, template_key, template_params)
      values (
        new.user_id,
        new.song_id,
        'generation',
        'completed',
        'notification.generation.completed',
        jsonb_build_object('songTitle', coalesce(v_title, '未命名'))
      );
    end if;

    -- 任务失败
    if new.status = 'failed' and old.status <> 'failed' then
      insert into notifications (user_id, song_id, type, subtype, template_key, template_params)
      values (
        new.user_id,
        new.song_id,
        'generation',
        'failed',
        'notification.generation.failed',
        jsonb_build_object('songTitle', coalesce(v_title, '未命名'))
      );
    end if;
  exception when others then
    -- 静默失败：记录日志但不抛异常
    raise warning 'Failed to create notification: %', sqlerrm;
  end;

  return new;
end;
$$ language plpgsql security definer;

create trigger generation_tasks_notification
  after update on generation_tasks
  for each row
  when (old.status is distinct from new.status)
  execute function handle_task_notification();
```

**关键点：**
- 触发器包裹在 `begin ... exception ... end` 中：通知创建失败不阻塞 `generation_tasks` 状态更新
- 只处理 `music` 和 `cover` 类型：`album_cover` 暂不需要通知（无独立详情页）
- `coalesce(v_title, '未命名')`：歌曲标题可能为空，提供默认值
- `security definer`：以函数创建者权限执行，绕过 RLS

---

## 5. API 层变更

### 5.1 POST /api/songs/generate（追加通知插入）

在现有创建 song + generation_tasks 逻辑之后，追加同步插入通知：

```ts
// 现有逻辑：创建 song 记录
// 现有逻辑：创建 generation_tasks 记录

// 新增：同步插入"开始生成"通知
await supabase.from('notifications').insert({
  user_id: user.id,
  song_id: song.id,
  type: 'generation',
  subtype: 'started',
  template_key: 'notification.generation.started',
  template_params: { songTitle: song.title },
})
```

### 5.2 GET /api/notifications

拉取当前用户的通知列表，支持分页：

```ts
// GET /api/notifications?page=1&limit=20

export async function GET(request: Request) {
  const { user, supabase } = await getAuth()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = (page - 1) * limit

  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return new Response(error.message, { status: 500 })

  return Response.json({ data, count })
}
```

### 5.3 PATCH /api/notifications/:id/read

单条标记已读：

```ts
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { user, supabase } = await getAuth()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return new Response(error.message, { status: 500 })
  return new Response('OK', { status: 200 })
}
```

### 5.4 PATCH /api/notifications/read-all

批量标记已读：

```ts
export async function PATCH(request: Request) {
  const { user, supabase } = await getAuth()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return new Response(error.message, { status: 500 })
  return new Response('OK', { status: 200 })
}
```

---

## 6. 前端设计

### 6.1 组件结构

```
components/notifications/
  notification-bell.tsx      # Header 铃铛图标 + 未读计数
  notification-panel.tsx     # 下拉通知列表
  notification-item.tsx      # 单条通知渲染
  notification-provider.tsx  # 全局 Provider（可选，用于包裹应用）

hooks/
  use-notifications.ts       # Realtime 订阅 + 查询 + 状态管理
```

### 6.2 useNotifications Hook

```ts
export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // 初始加载
  useEffect(() => {
    if (!userId) return
    fetchNotifications().then(data => {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
      setIsLoading(false)
    })
  }, [userId])

  // Realtime 订阅
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications(prev => [newNotification, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead }
}
```

### 6.3 通知渲染

```tsx
// notification-item.tsx
function NotificationItem({ notification, onClick }: Props) {
  const t = useTranslations()
  const text = t(notification.template_key, notification.template_params)

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50',
        !notification.is_read && 'bg-blue-50'
      )}
      onClick={() => onClick(notification)}
    >
      {/* 状态指示器 */}
      {!notification.is_read && (
        <div className={cn(
          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
          notification.subtype === 'failed' ? 'bg-red-500' : 'bg-blue-500'
        )} />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm',
          notification.is_read ? 'text-gray-500' : 'text-gray-900'
        )}>
          {text}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}
```

### 6.4 点击行为

点击通知时：
1. 调用 `markAsRead(notification.id)` 标记已读
2. 根据 `song_id` 构建跳转 URL：`router.push(`/${locale}/songs/${song_id}`)`

---

## 7. i18n 翻译

### 7.1 中文

```json
// apps/web/messages/zh.json
{
  "notification": {
    "generation": {
      "started": "⏳ 已开始生成歌曲《{songTitle}》",
      "completed": "🎵 你的歌曲《{songTitle}》已生成完成，点击收听",
      "failed": "❌ 歌曲《{songTitle}》生成失败，请重试"
    }
  }
}
```

### 7.2 英文

```json
// apps/web/messages/en.json
{
  "notification": {
    "generation": {
      "started": "⏳ Started generating song \"{songTitle}\"",
      "completed": "🎵 Your song \"{songTitle}\" is ready! Click to listen",
      "failed": "❌ Song \"{songTitle}\" generation failed, please retry"
    }
  }
}
```

---

## 8. 错误处理策略

| 场景 | 处理方式 |
|------|---------|
| 触发器内通知创建失败 | 包裹在 `exception when others` 中，静默吞掉，不阻塞 `generation_tasks` 更新 |
| API Route 通知插入失败 | 记录错误日志，返回 202（不阻塞用户请求） |
| Realtime 连接断开 | 自动重连（Supabase client 内置），离线期间的通知下次加载时拉取 |
| 通知关联的歌曲已删除 | `song_id` 设为 NULL，通知仍保留，显示为「未命名」 |
| 翻译 key 缺失 | next-intl 默认回退到 key 本身，开发时通过类型检查避免 |

---

## 9. 测试策略

| 测试类型 | 文件 | 覆盖内容 |
|---------|------|---------|
| 数据库迁移测试 | `supabase-local/migrations/*.sql` | `notifications` 表创建、索引、RLS、触发器 |
| 触发器单元测试 | `packages/supabase/src/__tests__/notification-trigger.test.ts` | task 状态变更时正确创建通知、album_cover 不触发、异常时静默失败 |
| API 集成测试 | `apps/web/src/app/api/notifications/route.test.ts` | GET 拉取列表、PATCH 单条已读、PATCH 全部已读、未授权访问 |
| 生成 API 测试 | `apps/web/src/app/api/songs/generate/route.test.ts` | 创建 song 时同步创建 started 通知 |
| 组件测试 | `apps/web/src/components/notifications/*.test.tsx` | NotificationBell 未读计数、NotificationPanel 点击跳转 |
| E2E（可选） | `apps/web/tests/e2e/notifications.spec.ts` | 模拟生成完成后通知铃铛更新 |

---

## 10. 未来扩展

| 扩展 | 说明 |
|------|------|
| 邮件通知 | 当通知插入时，触发器或 Supabase Webhook 调用邮件服务（Resend/SendGrid） |
| 通知设置 | 用户可关闭特定类型的通知（如关闭"开始生成"，只保留完成/失败） |
| 评论/点赞通知 | `type` 字段已预留 `'comment'`, `'system'` 等值 |
| 推送通知 | PWA Service Worker + Web Push API |

---

## 11. 变更清单

### 数据库迁移
- [ ] `20260511_create_notifications.sql` — 创建表、索引、RLS、触发器
- [ ] `alter publication supabase_realtime add table notifications` — 启用 Realtime

### API 路由
- [ ] `apps/web/src/app/api/notifications/route.ts` — GET 列表
- [ ] `apps/web/src/app/api/notifications/[id]/read/route.ts` — PATCH 单条已读
- [ ] `apps/web/src/app/api/notifications/read-all/route.ts` — PATCH 全部已读
- [ ] `apps/web/src/app/api/songs/generate/route.ts` — 追加 started 通知插入

### 前端组件
- [ ] `apps/web/src/components/notifications/notification-bell.tsx`
- [ ] `apps/web/src/components/notifications/notification-panel.tsx`
- [ ] `apps/web/src/components/notifications/notification-item.tsx`
- [ ] `apps/web/src/hooks/use-notifications.ts`
- [ ] `apps/web/src/app/[locale]/layout.tsx` — 集成 NotificationBell 到 Header

### i18n
- [ ] `apps/web/messages/zh.json` — 添加 notification.generation.*
- [ ] `apps/web/messages/en.json` — 添加 notification.generation.*

### 测试
- [ ] 触发器单元测试
- [ ] API 路由测试
- [ ] 组件测试

---

## 12. 决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 通知方式 | 邮件/站内/两者 | **站内** | 无邮件服务器，站内通知成本最低 |
| 通知场景 | 完成/失败/开始 | **全部** | 完整用户体验闭环 |
| 实时推送 | 轮询/Realtime | **Realtime** | 已用 Supabase，零额外依赖 |
| 通知创建 | API/触发器/混合 | **混合** | "开始"在 API Route、"完成/失败"在触发器 |
| 点击行为 | 跳转/预览/弹窗 | **直接跳转** | 最少交互步骤 |
| 通知内容 | 前端模板/后端固定/模板 key | **模板 key + 参数** | 天然支持 i18n，数据自包含 |
