# 封面生成即时触发设计文档

## 背景与问题

Vercel Hobby 计划限制 cron job 每天只能执行一次。当前架构中，封面生成任务依赖 cron 触发 Supabase Edge Function 执行，导致用户在非 cron 触发时间点点击"生成封面"后，需要等待将近 24 小时才能看到结果。

## 目标

用户点击"生成封面"后，任务应在秒级延迟内开始执行，而不是等待 cron 下次触发。

## 方案概述

**方案：用户点击时直接触发 Edge Function（fire-and-forget）**

在用户点击"生成封面"的 API 路由中，创建 `generation_tasks` 记录后，立即以 fire-and-forget 方式调用 Supabase Edge Function `process-generation-task`。cron 保留为兜底机制，每天凌晨 2:00 检查并处理漏掉的 pending 任务。

## 架构图

```
Before:
用户点击"生成封面"
    │
    ▼
POST /api/songs/{id}/cover?action=generate
    │
    ├── 创建 generation_tasks (status='pending')
    │
    ▼
返回 HTTP 202
    │
    ▼
前端轮询（每10秒）←── 一直轮询到明天 2:00
    │
    ▼
Cron 每天 2:00 触发
    │
    ▼
调用 Edge Function → 认领任务 → 执行

After:
用户点击"生成封面"
    │
    ▼
POST /api/songs/{id}/cover?action=generate
    │
    ├── 创建 generation_tasks (status='pending')
    ├── fire-and-forget 调用 Edge Function ─────────────────────┐
    │                                                           ▼
返回 HTTP 202                                               认领任务 → 执行
    │                                                           │
    ▼                                                           ▼
前端轮询（每10秒）←────────────────────────────────────── 任务完成
                                                              │
Cron 每天 2:00 触发（兜底）←── 处理未被触发的 pending 任务
```

## 具体改动

### 文件 1：`apps/web/src/app/api/songs/[id]/cover/route.ts`

在 `action === 'generate'` 分支中，任务创建成功后、返回 202 之前，增加 fire-and-forget 触发：

```typescript
import { createServerClient, createServiceRoleClient } from '@kiyo/supabase/server'

// ... 现有代码 ...

if (taskError || !task) {
  // ... 错误处理不变 ...
}

// Fire-and-forget: trigger immediate processing
void createServiceRoleClient()
  .functions.invoke('process-generation-task')
  .catch((err) => {
    console.error('Failed to trigger generation worker:', err)
  })

return NextResponse.json(
  { task, coverStatus: 'generating' },
  {
    status: 202,
    headers: { 'Retry-After': '10' },
  }
)
```

### 文件 2：`apps/web/src/app/api/albums/[id]/cover/route.ts`

与歌曲封面相同的改动：导入 `createServiceRoleClient`，在任务创建成功后 fire-and-forget 触发 Edge Function。

### 文件 3：`apps/web/vercel.json`

保持现有配置，cron 作为兜底机制：

```json
{
  "crons": [
    {
      "path": "/api/tasks/worker",
      "schedule": "0 2 * * *"
    }
  ]
}
```

## 错误处理

- **Edge Function 调用失败**：不影响主流程，用户仍收到 202 响应，前端正常轮询。cron 兜底会处理 pending 任务。
- **Edge Function 执行失败**：现有重试机制（最多 3 次，渐进延迟 0s → 30s → 60s）仍然有效。
- **任务创建失败**：现有回滚逻辑不变（`cover_status` 回滚为 `failed`）。

## 并发安全

Supabase Edge Function 中使用 `claim_pending_task()` 函数，基于 `FOR UPDATE SKIP LOCKED` 实现原子任务认领。即使多个请求同时触发 Edge Function，也不会重复处理同一个任务。

## 成本分析

Supabase 免费计划 Edge Function 额度为 **500,000 次调用/月**。封面生成是用户手动点击的低频操作，假设每天 100 人各点 10 次，一个月 30,000 次，远低于上限。

## 验证计划

1. 在本地环境点击"生成封面"，观察网络面板确认 API 返回 202
2. 查看 Supabase Edge Function 日志，确认 `process-generation-task` 被立即调用
3. 确认任务在秒级时间内从 `pending` → `processing` → `completed`
4. 确认前端轮询在合理时间内检测到 `cover_status` 变为 `completed`
5. 关闭直接触发（临时注释代码），确认 cron 仍能正常兜底处理 pending 任务
