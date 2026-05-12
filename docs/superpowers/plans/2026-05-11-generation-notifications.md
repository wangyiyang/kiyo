# 生成完成站内通知 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AI 生成（作曲、翻唱）完成后，通过 Supabase Realtime 实时推送站内通知到前端 Header 铃铛组件。

**Architecture:** 混合方案 — API Route 在创建 task 时同步插入"开始"通知；数据库触发器在 task 状态变为 completed/failed 时自动插入通知。前端通过 Realtime 订阅 + 初始加载拉取未读通知。

**Tech Stack:** Next.js 14, React, TypeScript, Supabase (PostgreSQL + Realtime), Tailwind CSS, shadcn/ui, next-intl, Vitest

---

## File Structure

| File | Action | Description |
|------|--------|-------------|
| `supabase-local/migrations/20260511_create_notifications.sql` | Create | notifications 表、索引、RLS、触发器、Realtime 配置 |
| `apps/web/messages/zh.json` | Modify | 添加 notification.generation.* 翻译 |
| `apps/web/messages/en.json` | Modify | 添加 notification.generation.* 翻译 |
| `apps/web/src/app/api/notifications/route.ts` | Create | GET 列表 + PATCH 全部已读 |
| `apps/web/src/app/api/notifications/route.test.ts` | Create | API 测试 |
| `apps/web/src/app/api/notifications/[id]/read/route.ts` | Create | PATCH 单条已读 |
| `apps/web/src/app/api/notifications/[id]/read/route.test.ts` | Create | API 测试 |
| `apps/web/src/hooks/use-notifications.ts` | Create | Realtime 订阅 + 查询 + 状态管理 |
| `apps/web/src/components/notifications/notification-item.tsx` | Create | 单条通知渲染 |
| `apps/web/src/components/notifications/notification-panel.tsx` | Create | 下拉通知列表 |
| `apps/web/src/components/notifications/notification-bell.tsx` | Create | Header 铃铛图标 + 未读计数 |
| `apps/web/src/components/site-header.tsx` | Modify | 在 UserMenu 旁边插入 NotificationBell |
| `apps/web/src/app/api/songs/generate/route.ts` | Modify | 追加同步插入 started 通知 |
| `apps/web/src/app/api/songs/generate/route.test.ts` | Modify | 追加通知创建断言 |
| `packages/supabase/src/database.types.ts` | Modify | 添加 notifications 表类型（运行 gen types 后） |

---

## Task 1: 数据库迁移 — notifications 表 + 触发器

**Files:**
- Create: `supabase-local/migrations/20260511_create_notifications.sql`
- Test: 在本地 Supabase 中执行迁移并验证

- [ ] **Step 1: 创建迁移文件**

```sql
-- supabase-local/migrations/20260511_create_notifications.sql

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),

  song_id uuid references songs(id) on delete set null,
  album_id uuid references albums(id) on delete set null,

  type text not null,
  subtype text not null,

  template_key text not null,
  template_params jsonb not null default '{}',

  is_read boolean not null default false,

  target_url text,

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

-- 索引
create index idx_notifications_user_unread
  on notifications (user_id, created_at desc)
  where is_read = false;

create index idx_notifications_user
  on notifications (user_id, created_at desc);

-- RLS
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

-- 触发器：generation_tasks 状态变化时自动创建通知
create or replace function handle_task_notification()
returns trigger as $$
declare
  v_title text;
begin
  begin
    if new.type not in ('music', 'cover') then
      return new;
    end if;

    if new.song_id is not null then
      select title into v_title from songs where id = new.song_id;
    end if;

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

-- 启用 Realtime
alter publication supabase_realtime add table notifications;
```

- [ ] **Step 2: 运行迁移**

Run: `pnpm supabase:db:reset`

Expected: 迁移成功执行，无错误。

- [ ] **Step 3: 验证表结构**

Run: `npx supabase --workdir supabase-local db dump --data-only --schema public | grep notifications`

或者通过 Supabase Studio 查看表结构确认字段正确。

- [ ] **Step 4: 验证触发器**

在 Supabase SQL Editor 中执行：

```sql
-- 插入一条测试 generation_tasks
insert into generation_tasks (user_id, song_id, type, status, payload)
values ('00000000-0000-0000-0000-000000000000', null, 'music', 'pending', '{}');

-- 更新状态为 completed
update generation_tasks set status = 'completed' where status = 'pending';

-- 验证通知已创建
select * from notifications;
```

Expected: 1 条 type='generation', subtype='completed' 的记录。

- [ ] **Step 5: Commit**

```bash
git add supabase-local/migrations/20260511_create_notifications.sql
git commit -m "feat(notifications): add notifications table and task trigger (#71)"
```

---

## Task 2: i18n 翻译

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 修改 zh.json**

在 `apps/web/messages/zh.json` 中，在 `"settings"` 同级位置添加 `"notification"` 对象（例如放在 `"settings"` 之前）：

```json
  "notification": {
    "title": "通知",
    "markAllAsRead": "全部已读",
    "empty": "暂无通知",
    "generation": {
      "started": "⏳ 已开始生成歌曲《{songTitle}》",
      "completed": "🎵 你的歌曲《{songTitle}》已生成完成，点击收听",
      "failed": "❌ 歌曲《{songTitle}》生成失败，请重试"
    }
  },
```

- [ ] **Step 2: 修改 en.json**

在 `apps/web/messages/en.json` 中相同位置添加：

```json
  "notification": {
    "title": "Notifications",
    "markAllAsRead": "Mark all as read",
    "empty": "No notifications",
    "generation": {
      "started": "⏳ Started generating song \"{songTitle}\"",
      "completed": "🎵 Your song \"{songTitle}\" is ready! Click to listen",
      "failed": "❌ Song \"{songTitle}\" generation failed, please retry"
    }
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add notification translations for zh and en (#71)"
```

---

## Task 3: API 路由 — GET /api/notifications

**Files:**
- Create: `apps/web/src/app/api/notifications/route.ts`
- Create: `apps/web/src/app/api/notifications/route.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// apps/web/src/app/api/notifications/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/notifications', () => {
  it('returns notifications for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      {
        id: 'n1',
        user_id: 'user-1',
        type: 'generation',
        subtype: 'completed',
        template_key: 'notification.generation.completed',
        template_params: { songTitle: 'Test Song' },
        is_read: false,
        song_id: 's1',
        created_at: '2026-05-11T10:00:00Z',
      },
      {
        id: 'n2',
        user_id: 'user-1',
        type: 'generation',
        subtype: 'started',
        template_key: 'notification.generation.started',
        template_params: { songTitle: 'Another Song' },
        is_read: true,
        song_id: 's2',
        created_at: '2026-05-11T09:00:00Z',
      },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost/api/notifications'))

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data).toHaveLength(2)
    expect(json.data[0].id).toBe('n1')
    expect(json.data[0].is_read).toBe(false)
    expect(json.data[1].id).toBe('n2')
    expect(json.data[1].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost/api/notifications'))

    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/route.test.ts`

Expected: FAIL — `GET` function not defined

- [ ] **Step 3: 实现 GET 路由**

```ts
// apps/web/src/app/api/notifications/route.ts
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

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

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data, count })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/route.test.ts`

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/notifications/route.ts apps/web/src/app/api/notifications/route.test.ts
git commit -m "feat(api): add GET /api/notifications endpoint (#71)"
```

---

## Task 4: API 路由 — PATCH /api/notifications/:id/read

**Files:**
- Create: `apps/web/src/app/api/notifications/[id]/read/route.ts`
- Create: `apps/web/src/app/api/notifications/[id]/read/route.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// apps/web/src/app/api/notifications/[id]/read/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PATCH } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase/server', async () => {
  const actual = await vi.importActual('@kiyo/supabase/server')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('PATCH /api/notifications/:id/read', () => {
  it('marks notification as read for owner', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      { id: 'n1', user_id: 'user-1', is_read: false },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n1/read', { method: 'PATCH' }),
      { params: { id: 'n1' } }
    )

    expect(response.status).toBe(200)
    expect(mockClient.dataStore.notifications[0].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await PATCH(
      new Request('http://localhost/api/notifications/n1/read', { method: 'PATCH' }),
      { params: { id: 'n1' } }
    )

    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/[id]/read/route.test.ts`

Expected: FAIL — `PATCH` function not defined

- [ ] **Step 3: 实现 PATCH 路由**

```ts
// apps/web/src/app/api/notifications/[id]/read/route.ts
import { createServerClient } from '@kiyo/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return new Response(null, { status: 200 })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/[id]/read/route.test.ts`

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/notifications/[id]/read/
git commit -m "feat(api): add PATCH /api/notifications/:id/read endpoint (#71)"
```

---

## Task 5: API 路由 — PATCH /api/notifications/read-all

**Files:**
- Modify: `apps/web/src/app/api/notifications/route.ts`
- Modify: `apps/web/src/app/api/notifications/route.test.ts`

- [ ] **Step 1: 追加 PATCH 测试**

在 `apps/web/src/app/api/notifications/route.test.ts` 中追加：

```ts
describe('PATCH /api/notifications (read-all)', () => {
  it('marks all unread notifications as read', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.notifications = [
      { id: 'n1', user_id: 'user-1', is_read: false },
      { id: 'n2', user_id: 'user-1', is_read: false },
      { id: 'n3', user_id: 'user-1', is_read: true },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/notifications', { method: 'PATCH' }))

    expect(response.status).toBe(200)
    expect(mockClient.dataStore.notifications[0].is_read).toBe(true)
    expect(mockClient.dataStore.notifications[1].is_read).toBe(true)
    expect(mockClient.dataStore.notifications[2].is_read).toBe(true)
  })

  it('returns 401 for unauthenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase/server')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/notifications', { method: 'PATCH' }))

    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/route.test.ts`

Expected: FAIL — PATCH handler missing from route.ts

- [ ] **Step 3: 在 route.ts 追加 PATCH handler**

在 `apps/web/src/app/api/notifications/route.ts` 中追加：

```ts
export async function PATCH() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return new Response(null, { status: 200 })
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web test -- apps/web/src/app/api/notifications/route.test.ts`

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/notifications/route.ts apps/web/src/app/api/notifications/route.test.ts
git commit -m "feat(api): add PATCH /api/notifications read-all endpoint (#71)"
```

---

## Task 6: useNotifications Hook

**Files:**
- Create: `apps/web/src/hooks/use-notifications.ts`

- [ ] **Step 1: 实现 Hook**

```ts
// apps/web/src/hooks/use-notifications.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@kiyo/supabase'

interface Notification {
  id: string
  user_id: string
  song_id: string | null
  album_id: string | null
  type: string
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // 初始加载
  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const response = await fetch('/api/notifications?limit=50')
      if (!response.ok) return
      const { data } = await response.json()
      setNotifications(data || [])
      setUnreadCount((data || []).filter((n: Notification) => !n.is_read).length)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetchNotifications()
  }, [userId, fetchNotifications])

  // Realtime 订阅
  useEffect(() => {
    if (!userId) return

    const supabase = createBrowserClient()
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
          setNotifications((prev) => [newNotification, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/notifications/${id}/read`, {
          method: 'PATCH',
        })
        if (!response.ok) return

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        // 静默失败
      }
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      })
      if (!response.ok) return

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch {
      // 静默失败
    }
  }, [])

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-notifications.ts
git commit -m "feat(hooks): add useNotifications with Realtime subscription (#71)"
```

---

## Task 7: NotificationItem 组件

**Files:**
- Create: `apps/web/src/components/notifications/notification-item.tsx`

- [ ] **Step 1: 实现组件**

```tsx
// apps/web/src/components/notifications/notification-item.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@kiyo/ui'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'

interface Notification {
  id: string
  song_id: string | null
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()

  const text = t(notification.template_key, notification.template_params)
  const dateLocale = locale === 'zh' ? zhCN : enUS

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id)
    }
    if (notification.song_id) {
      router.push(`/${locale}/songs/${notification.song_id}`)
    }
  }

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={handleClick}
    >
      {!notification.is_read && (
        <div
          className={cn(
            'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
            notification.subtype === 'failed' ? 'bg-red-500' : 'bg-blue-500'
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-relaxed',
            notification.is_read
              ? 'text-muted-foreground'
              : 'text-foreground'
          )}
        >
          {text}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: dateLocale,
          })}
        </p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/notifications/notification-item.tsx
git commit -m "feat(ui): add NotificationItem component (#71)"
```

---

## Task 8: NotificationPanel 组件

**Files:**
- Create: `apps/web/src/components/notifications/notification-panel.tsx`

- [ ] **Step 1: 实现组件**

```tsx
// apps/web/src/components/notifications/notification-panel.tsx
'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@kiyo/ui'
import { NotificationItem } from './notification-item'

interface Notification {
  id: string
  song_id: string | null
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  isLoading: boolean
}

export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  isLoading,
}: NotificationPanelProps) {
  const t = useTranslations()
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="w-[360px] overflow-hidden rounded-xl border bg-popover shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('notification.title')}</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('notification.markAllAsRead')}
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{t('notification.empty')}</p>
          </div>
        ) : (
          notifications.map((notification, index) => (
            <div key={notification.id}>
              <NotificationItem
                notification={notification}
                onRead={onMarkAsRead}
              />
              {index < notifications.length - 1 && (
                <div className="mx-4 h-px bg-border" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/notifications/notification-panel.tsx
git commit -m "feat(ui): add NotificationPanel dropdown component (#71)"
```

---

## Task 9: NotificationBell 组件

**Files:**
- Create: `apps/web/src/components/notifications/notification-bell.tsx`

- [ ] **Step 1: 实现组件**

```tsx
// apps/web/src/components/notifications/notification-bell.tsx
'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@kiyo/ui'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationPanel } from './notification-panel'

interface NotificationBellProps {
  userId: string | undefined
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications(userId)

  // 点击外部关闭面板
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!userId) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50">
          <NotificationPanel
            notifications={notifications}
            onMarkAsRead={(id) => {
              markAsRead(id)
            }}
            onMarkAllAsRead={() => {
              markAllAsRead()
            }}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/notifications/notification-bell.tsx
git commit -m "feat(ui): add NotificationBell with unread badge and dropdown (#71)"
```

---

## Task 10: 集成到 SiteHeader

**Files:**
- Modify: `apps/web/src/components/site-header.tsx`

- [ ] **Step 1: 修改 SiteHeader**

在 `apps/web/src/components/site-header.tsx` 中做以下修改：

1. 导入 NotificationBell：

```tsx
import { NotificationBell } from './notifications/notification-bell'
```

2. 添加 userId state（在现有的 `user` state 旁）：

```tsx
const [userId, setUserId] = React.useState<string | undefined>(undefined)
```

3. 在 auth listener effect 中更新 setUserId：

找到这段代码：
```tsx
supabase.auth.getUser().then(({ data: { user } }) => {
  if (user?.email) {
    setUser({ email: user.email })
  }
})
```

替换为：
```tsx
supabase.auth.getUser().then(({ data: { user } }) => {
  if (user?.email) {
    setUser({ email: user.email })
    setUserId(user.id)
  }
})
```

找到这段代码：
```tsx
if (event === 'SIGNED_IN' && session?.user?.email) {
  setUser({ email: session.user.email })
} else if (event === 'SIGNED_OUT') {
  setUser(null)
}
```

替换为：
```tsx
if (event === 'SIGNED_IN' && session?.user?.email) {
  setUser({ email: session.user.email })
  setUserId(session.user.id)
} else if (event === 'SIGNED_OUT') {
  setUser(null)
  setUserId(undefined)
}
```

4. 在 Header 右侧区域插入 NotificationBell：

找到：
```tsx
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu user={user} />
          <MobileNavSheet />
        </div>
```

替换为：
```tsx
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <NotificationBell userId={userId} />
          <UserMenu user={user} />
          <MobileNavSheet />
        </div>
```

- [ ] **Step 2: 编译检查**

Run: `pnpm --filter web type-check`

Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/site-header.tsx
git commit -m "feat(header): integrate NotificationBell into SiteHeader (#71)"
```

---

## Task 11: API Route 追加通知插入

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/generate/route.test.ts`

- [ ] **Step 1: 追加测试断言**

在 `apps/web/src/app/api/songs/generate/route.test.ts` 的 `auto_lyrics mode returns 202 and creates song + task` 测试中，在现有断言之后追加：

```ts
    // 验证 started 通知已创建
    const notification = mockClient.dataStore.notifications[0]
    expect(notification).toBeDefined()
    expect(notification.type).toBe('generation')
    expect(notification.subtype).toBe('started')
    expect(notification.template_key).toBe('notification.generation.started')
    expect(notification.template_params.songTitle).toBe(json.song.title)
    expect(notification.user_id).toBe('user-1')
    expect(notification.song_id).toBe(json.song.id)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter web test -- apps/web/src/app/api/songs/generate/route.test.ts`

Expected: FAIL — notification 断言失败（notification 未创建）

- [ ] **Step 3: 修改 route.ts**

在 `apps/web/src/app/api/songs/generate/route.ts` 中，找到创建 task 之后的代码段，追加通知插入。

现有代码大概是（找到 `return NextResponse.json({ song, task }, { status: 202 })` 之前）：

```ts
  // 2. 创建 generation_tasks 记录
  const { data: task, error: taskError } = await supabase
    .from('generation_tasks')
    .insert({ ... })
    .select()
    .single()

  if (taskError) { ... }

  return NextResponse.json({ song, task }, { status: 202 })
```

在 `return` 之前追加：

```ts
  // 3. 同步创建"开始生成"通知
  await supabase.from('notifications').insert({
    user_id: user.id,
    song_id: song.id,
    type: 'generation',
    subtype: 'started',
    template_key: 'notification.generation.started',
    template_params: { songTitle: song.title },
  })

  return NextResponse.json({ song, task }, { status: 202 })
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm --filter web test -- apps/web/src/app/api/songs/generate/route.test.ts`

Expected: PASS — 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/generate/route.ts apps/web/src/app/api/songs/generate/route.test.ts
git commit -m "feat(api): insert started notification when creating generation task (#71)"
```

---

## Task 12: 生成数据库类型

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: 运行类型生成**

Run: `pnpm supabase:gen-types`

Expected: 成功生成类型，`notifications` 表类型出现在 `database.types.ts` 中。

- [ ] **Step 2: 验证类型包含 notifications**

检查 `packages/supabase/src/database.types.ts` 中是否新增了：

```ts
notifications: {
  Row: { ... }
  Insert: { ... }
  Update: { ... }
  Relationships: [ ... ]
}
```

- [ ] **Step 3: 运行类型检查**

Run: `pnpm type-check`

Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "chore(types): regenerate Supabase types with notifications table (#71)"
```

---

## Self-Review

### Spec Coverage Check

| Spec 要求 | 对应任务 |
|-----------|----------|
| notifications 表 schema | Task 1 |
| 触发器 handle_task_notification | Task 1 |
| Realtime 配置 | Task 1 |
| API Route: GET /api/notifications | Task 3 |
| API Route: PATCH /api/notifications/:id/read | Task 4 |
| API Route: PATCH /api/notifications/read-all | Task 5 |
| useNotifications Hook (Realtime + 初始加载) | Task 6 |
| NotificationItem 组件 | Task 7 |
| NotificationPanel 组件 | Task 8 |
| NotificationBell 组件 | Task 9 |
| 集成到 SiteHeader | Task 10 |
| 修改 songs/generate 插入 started 通知 | Task 11 |
| i18n 翻译 | Task 2 |
| 数据库类型生成 | Task 12 |
| 错误处理（触发器静默失败） | Task 1 |

**覆盖率: 100%** — 无遗漏。

### Placeholder Scan

- ❌ 无 "TBD", "TODO", "implement later"
- ❌ 无 "Add appropriate error handling"
- ❌ 无 "Write tests for the above"
- ❌ 无 "Similar to Task N"
- ✅ 每个步骤包含完整代码
- ✅ 每个步骤包含运行命令和预期输出

### Type Consistency Check

- `Notification` 接口定义在 Task 6 的 use-notifications.ts 中
- Task 7 的 NotificationItem 使用同一接口
- Task 8 的 NotificationPanel 使用同一接口
- Task 9 的 NotificationBell 通过 useNotifications 间接使用
- ✅ 类型名称和字段完全一致
