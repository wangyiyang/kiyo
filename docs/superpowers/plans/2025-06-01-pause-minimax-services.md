# 暂停 MiniMax AI 服务及用户注册 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 临时暂停所有涉及 MiniMax API 的 AI 生成服务（歌词、音乐、翻唱、重试）以及新用户注册，前端显示多语言暂停公告，API 直接返回 503。

**Architecture:** 采用"前端禁用+API 硬拦截+多语言公告"三层保护。前端通过可复用 `ServicePausedBanner` 组件在受影响页面顶部展示琥珀色警告并禁用表单；API 层在入口处第一时间返回 503 `SERVICE_PAUSED`，避免任何 MiniMax 调用穿透。

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, next-intl, shadcn/ui

---

## 文件映射

| 文件 | 职责 |
|------|------|
| `apps/web/src/components/service-paused-banner.tsx` | 新增可复用暂停公告横幅组件 |
| `apps/web/src/app/api/songs/generate/route.ts` | 插入 503 拦截（新建歌曲 AI 生成） |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | 插入 503 拦截（歌曲重生成） |
| `apps/web/src/app/api/songs/cover/route.ts` | 插入 503 拦截（翻唱/封面生成） |
| `apps/web/src/app/api/lyrics/generate/route.ts` | 插入 503 拦截（AI 歌词生成） |
| `apps/web/src/app/api/tasks/retry/route.ts` | 插入 503 拦截（任务重试） |
| `apps/web/src/app/actions/auth.ts` | `signUp` 开头直接返回错误 |
| `apps/web/src/app/[locale]/(dashboard)/songs/new/page.tsx` | 显示横幅，禁用表单提交 |
| `apps/web/src/app/[locale]/(dashboard)/songs/cover/page.tsx` | 显示横幅，禁用生成表单 |
| `apps/web/src/app/[locale]/(dashboard)/lyrics/generate/page.tsx` | 显示横幅，禁用表单提交 |
| `apps/web/src/app/[locale]/(site)/register/page.tsx` | 显示横幅，禁用注册表单和 OAuth |
| `apps/web/src/app/[locale]/(dashboard)/songs/songs-list.tsx` | 禁用"新建歌曲"和"翻唱"按钮 |
| `apps/web/src/app/[locale]/(dashboard)/lyrics/lyrics-list.tsx` | 禁用"AI 生成歌词"按钮 |
| `apps/web/src/app/[locale]/(dashboard)/songs/[id]/page.tsx` | 禁用"AI 翻唱"按钮 |
| `apps/web/messages/{zh,en,ja,ko}.json` | 新增 `common.servicePaused.*` 多语言文案 |

---

### Task 1: 多语言文案

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/ko.json`

- [ ] **Step 1: 在 zh.json 的 `common` 对象内添加 `servicePaused` 键**

在 `apps/web/messages/zh.json` 中找到 `common` 对象，在其末尾添加（注意 JSON 逗号）：

```json
    "servicePaused": {
      "title": "服务暂停",
      "message": "AI 生成服务暂停中，您仍可正常浏览和收听音乐。",
      "registerTitle": "注册暂停",
      "registerMessage": "新用户注册暂停中。"
    }
```

- [ ] **Step 2: 在 en.json 添加英文版本**

```json
    "servicePaused": {
      "title": "Service Paused",
      "message": "AI generation services are paused. You can still browse and listen to music.",
      "registerTitle": "Registration Paused",
      "registerMessage": "New user registration is currently paused."
    }
```

- [ ] **Step 3: 在 ja.json 添加日文版本**

```json
    "servicePaused": {
      "title": "サービス停止中",
      "message": "AI生成サービスは停止中です。音楽の閲覧と再生は引き続きご利用いただけます。",
      "registerTitle": "登録停止中",
      "registerMessage": "新規ユーザー登録は現在停止中です。"
    }
```

- [ ] **Step 4: 在 ko.json 添加韩文版本**

```json
    "servicePaused": {
      "title": "서비스 일시 중지",
      "message": "AI 생성 서비스가 일시 중지되었습니다. 음악 탐색 및 재생은 정상적으로 이용하실 수 있습니다.",
      "registerTitle": "가입 일시 중지",
      "registerMessage": "신규 사용자 가입이 일시 중지되었습니다."
    }
```

- [ ] **Step 5: 验证 JSON 语法**

Run: `cat apps/web/messages/zh.json | python3 -m json.tool > /dev/null && echo "OK"`
Expected: `OK`

对 en.json、ja.json、ko.json 重复上述验证。

---

### Task 2: 可复用暂停公告组件

**Files:**
- Create: `apps/web/src/components/service-paused-banner.tsx`

- [ ] **Step 1: 创建 ServicePausedBanner 组件**

```tsx
'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ServicePausedBannerProps {
  type?: 'generate' | 'register'
}

export function ServicePausedBanner({ type = 'generate' }: ServicePausedBannerProps) {
  const t = useTranslations('common.servicePaused')

  const isRegister = type === 'register'

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            {isRegister ? t('registerTitle') : t('title')}
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {isRegister ? t('registerMessage') : t('message')}
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/service-paused-banner.tsx
git commit -m "feat: add ServicePausedBanner component"
```

---

### Task 3: API 层硬拦截

**Files:**
- Modify: `apps/web/src/app/api/songs/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/[id]/generate/route.ts`
- Modify: `apps/web/src/app/api/songs/cover/route.ts`
- Modify: `apps/web/src/app/api/lyrics/generate/route.ts`
- Modify: `apps/web/src/app/api/tasks/retry/route.ts`

- [ ] **Step 1: 拦截 `POST /api/songs/generate`**

在 `apps/web/src/app/api/songs/generate/route.ts` 中，找到 `export async function POST`，在其函数体第一行插入：

```ts
export async function POST(request: Request) {
  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )

  // ... existing code stays below, now unreachable
```

- [ ] **Step 2: 拦截 `POST /api/songs/[id]/generate`**

在 `apps/web/src/app/api/songs/[id]/generate/route.ts` 中，在 `POST` 函数体开头插入：

```ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )

  // ... existing code
```

- [ ] **Step 3: 拦截 `POST /api/songs/cover`**

在 `apps/web/src/app/api/songs/cover/route.ts` 中，在 `POST` 函数体开头插入：

```ts
export async function POST(request: Request) {
  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )

  // ... existing code
```

- [ ] **Step 4: 拦截 `POST /api/lyrics/generate`**

在 `apps/web/src/app/api/lyrics/generate/route.ts` 中，在 `POST` 函数体开头插入：

```ts
export async function POST(request: Request) {
  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )

  // ... existing code
```

- [ ] **Step 5: 拦截 `POST /api/tasks/retry`**

在 `apps/web/src/app/api/tasks/retry/route.ts` 中，在 `POST` 函数体开头插入：

```ts
export async function POST(request: Request) {
  return NextResponse.json(
    { error: { code: 'SERVICE_PAUSED', message: 'AI generation services are paused' } },
    { status: 503 }
  )

  // ... existing code
```

- [ ] **Step 6: 验证 TypeScript**

Run: `pnpm --filter web type-check`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/api/songs/generate/route.ts \
  apps/web/src/app/api/songs/\[id\]/generate/route.ts \
  apps/web/src/app/api/songs/cover/route.ts \
  apps/web/src/app/api/lyrics/generate/route.ts \
  apps/web/src/app/api/tasks/retry/route.ts
git commit -m "feat: block AI generation APIs with 503"
```

---

### Task 4: 注册后端拦截

**Files:**
- Modify: `apps/web/src/app/actions/auth.ts`

- [ ] **Step 1: 拦截 `signUp` action**

在 `apps/web/src/app/actions/auth.ts` 中，找到 `signUp` 函数，在其函数体开头（`const supabase = ...` 之前）插入：

```ts
export async function signUp(
  email: string,
  password: string
): Promise<AuthResult> {
  return {
    ok: false,
    message: 'New user registration is currently paused.',
    code: 'SERVICE_PAUSED',
  }

  const supabase = await createServerClient()
  // ... rest of existing code stays below, now unreachable
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/actions/auth.ts
git commit -m "feat: block user registration"
```

---

### Task 5: 前端页面横幅 + 禁用表单

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/songs/new/page.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/songs/cover/page.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/lyrics/generate/page.tsx`
- Modify: `apps/web/src/app/[locale]/(site)/register/page.tsx`

- [ ] **Step 1: `/songs/new` 页面禁用**

在 `apps/web/src/app/[locale]/(dashboard)/songs/new/page.tsx` 中：

1. 顶部导入 `ServicePausedBanner`：

```ts
import { ServicePausedBanner } from '@/components/service-paused-banner'
```

2. 在 `<h1>` 之前插入横幅，并给表单容器添加 `pointer-events-none opacity-50`：

将：
```tsx
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <SongCreateForm
```

替换为：
```tsx
      <ServicePausedBanner />

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="pointer-events-none opacity-50">
        <SongCreateForm
```

3. 在 `SongCreateForm` 闭合标签后加上 `</div>`：

找到：
```tsx
        onSuccess={(songId) => router.push(`/songs/${songId}`)}
      />
```

替换为：
```tsx
        onSuccess={(songId) => router.push(`/songs/${songId}`)}
      />
      </div>
```

- [ ] **Step 2: `/songs/cover` 页面禁用**

在 `apps/web/src/app/[locale]/(dashboard)/songs/cover/page.tsx` 中：

1. 顶部导入 `ServicePausedBanner`：

```ts
import { ServicePausedBanner } from '@/components/service-paused-banner'
```

2. 在 `<h1>` 之后插入横幅，并将表单区域包裹在 `pointer-events-none opacity-50` 中：

找到：
```tsx
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
```

替换为：
```tsx
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <ServicePausedBanner />

      <div className="pointer-events-none opacity-50">
        <div className="mb-6 space-y-4">
```

3. 在底部按钮区域闭合后加上 `</div>`：

找到：
```tsx
      <div className="flex justify-end gap-3">
        <Link href="/songs">
```

替换为：
```tsx
        <div className="flex justify-end gap-3">
          <Link href="/songs">
```

...并在 `</div>`（包含 Link + Button）之后找到下一个 `</div>`，确保表单区域被正确闭合。如果原结构是：

```tsx
      <div className="flex justify-end gap-3">
        ...
      </div>
    </div>
```

需要在最外层 `</div>` 前再插入一个 `</div>` 来关闭 `pointer-events-none` 的包裹层。如果原文件最外层已经是 `<div className="container ...">`，则包裹层应该放在最外层 div 内部。

更简洁的做法：把从 `<div className="mb-6 space-y-4">` 到最底部按钮 `</div>` 的所有内容包裹在 `pointer-events-none opacity-50` 的 div 中。

确认闭合后 Commit。

- [ ] **Step 3: `/lyrics/generate` 页面禁用**

在 `apps/web/src/app/[locale]/(dashboard)/lyrics/generate/page.tsx` 中：

1. 导入 `ServicePausedBanner`
2. 在 `<h1>` 区域之后插入 `<ServicePausedBanner />`
3. 将 `<form onSubmit={handleSubmit}>` 开始标签替换为 `<form onSubmit={handleSubmit} className="space-y-5 pointer-events-none opacity-50">`

找到：
```tsx
      <form onSubmit={handleSubmit} className="space-y-5">
```

替换为：
```tsx
      <form onSubmit={handleSubmit} className="space-y-5 pointer-events-none opacity-50">
```

- [ ] **Step 4: `/register` 页面禁用**

在 `apps/web/src/app/[locale]/(site)/register/page.tsx` 中：

1. 导入 `ServicePausedBanner`
2. 在 `<Card>` 之前插入横幅，并包裹 `CardContent` 使其不可交互：

将：
```tsx
            <CardContent>
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
```

替换为：
```tsx
            <ServicePausedBanner type="register" />
            <CardContent className="pointer-events-none opacity-50">
              <RegisterForm />
              <p className="mt-4 text-center text-sm text-muted-foreground">
```

将闭合的 `</CardContent>` 保持不变即可。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/songs/new/page.tsx \
  apps/web/src/app/\[locale\]/\(dashboard\)/songs/cover/page.tsx \
  apps/web/src/app/\[locale\]/\(dashboard\)/lyrics/generate/page.tsx \
  apps/web/src/app/\[locale\]/\(site\)/register/page.tsx
git commit -m "feat: add service-paused banners and disable forms"
```

---

### Task 6: 列表页和详情页按钮禁用

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/songs/songs-list.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/lyrics/lyrics-list.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/songs/[id]/page.tsx`

- [ ] **Step 1: 歌曲列表页禁用按钮**

在 `apps/web/src/app/[locale]/(dashboard)/songs/songs-list.tsx` 中，找到：

```tsx
          <AuthGuardButton
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </AuthGuardButton>
          <Link
            href="/songs/cover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Mic2 className="h-4 w-4" />
            {t('list.cover')}
          </Link>
```

替换为：

```tsx
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-purple-600/50 px-4 py-2 text-sm font-medium text-white/70"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </button>
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-purple-600/50 px-4 py-2 text-sm font-medium text-white/70"
          >
            <Mic2 className="h-4 w-4" />
            {t('list.cover')}
          </button>
```

- [ ] **Step 2: 歌词列表页禁用按钮**

在 `apps/web/src/app/[locale]/(dashboard)/lyrics/lyrics-list.tsx` 中，找到：

```tsx
          <Link
            href="/lyrics/generate"
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" />
            {t('list.generate')}
          </Link>
```

替换为：

```tsx
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground/50"
          >
            <Sparkles className="h-4 w-4" />
            {t('list.generate')}
          </button>
```

- [ ] **Step 3: 歌曲详情页禁用 AI 翻唱按钮**

在 `apps/web/src/app/[locale]/(dashboard)/songs/[id]/page.tsx` 中，找到：

```tsx
              <Link href={`/songs/cover?original_song_id=${song.id}`}>
                <Button variant="outline" size="sm">
                  <Mic2 className="mr-1 h-4 w-4" />
                  {t('aiCover')}
                </Button>
              </Link>
```

替换为：

```tsx
              <Button variant="outline" size="sm" disabled>
                <Mic2 className="mr-1 h-4 w-4" />
                {t('aiCover')}
              </Button>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\[locale\]/\(dashboard\)/songs/songs-list.tsx \
  apps/web/src/app/\[locale\]/\(dashboard\)/lyrics/lyrics-list.tsx \
  apps/web/src/app/\[locale\]/\(dashboard\)/songs/\[id\]/page.tsx
git commit -m "feat: disable AI-related buttons in list and detail views"
```

---

## 自检

**1. Spec 覆盖检查：**
- ✅ 歌词 AI 生成 — Task 3 (API) + Task 5 (页面) + Task 6 (按钮)
- ✅ 音乐生成（新歌）— Task 3 (API) + Task 5 (页面) + Task 6 (按钮)
- ✅ 翻唱/封面生成 — Task 3 (API) + Task 5 (页面) + Task 6 (按钮)
- ✅ 歌曲重试生成 — Task 3 (API) + Task 5 (详情页禁用重试按钮通过 pointer-events)
- ✅ 用户注册 — Task 4 (后端) + Task 5 (前端)
- ✅ 多语言公告 — Task 1 + Task 2

**2. 占位符检查：**
- ✅ 无 TBD/TODO
- ✅ 所有代码块包含完整代码
- ✅ 所有步骤包含具体文件路径

**3. 类型一致性：**
- ✅ `ServicePausedBanner` 组件 `type` prop 为 `'generate' | 'register'`，与使用处一致
- ✅ 所有 API 返回的 error code 均为 `'SERVICE_PAUSED'`

---

## 执行交接

Plan complete and saved to `docs/superpowers/plans/2025-06-01-pause-minimax-services.md`.

**两种执行方式：**

1. **Subagent-Driven (推荐)** — 每个 Task 分配独立 subagent，完成后 review
2. **Inline Execution** — 在当前 session 逐 Task 执行，批量变更

**推荐 Inline Execution**，因为改动点虽多但逻辑重复（都是插入/禁用），在同一 context 下执行效率更高。

Which approach?
