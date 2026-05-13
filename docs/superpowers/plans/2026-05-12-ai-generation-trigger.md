# AI 生成触发统一入口实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/songs/new` 改造为唯一 AI 作曲入口，废弃草稿创建逻辑，统一导航入口。

**Architecture:** `/songs/new` 页面表单复用原 `/songs/generate` 的完整 UI 和交互，提交到 `POST /api/songs/generate`；旧 `/songs/generate` 页面删除，通过 `next.config.js` 301 重定向到 `/songs/new`；`POST /api/songs` 移除；导航入口合并。

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, next-intl, shadcn/ui, Vitest

---

## File Structure

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/src/app/[locale]/songs/new/page.tsx` | 重写 | 草稿表单 → AI 生成表单 |
| `apps/web/src/app/[locale]/songs/generate/page.tsx` | 删除 | 通过重定向替代 |
| `apps/web/next.config.js` | 修改 | 添加 `/songs/generate` → `/songs/new` 301 重定向 |
| `apps/web/src/app/api/songs/route.ts` | 修改 | 移除 `POST` handler，保留 `GET` |
| `apps/web/src/app/api/songs/route.test.ts` | 修改 | 移除所有 `POST` 测试用例 |
| `apps/web/src/app/[locale]/songs/page.tsx` | 修改 | 移除"新建歌曲"按钮，"AI 作曲"指向 `/songs/new` |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | 修改 | 合并"新建歌曲"和"AI 作曲"为单个"AI 作曲" |
| `apps/web/messages/zh.json` | 修改 | 更新 `songs.new` namespace，合并按钮文案 |
| `apps/web/messages/en.json` | 修改 | 同上，英文 |
| `apps/web/src/i18n/app-route-structure.test.ts` | 修改 | 从 `localizedRouteFiles` 移除 `songs/generate/page.tsx` |

---

## Task 1: 添加 Next.js 重定向配置

**Files:**
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: 在 next.config.js 中添加 redirects**

在现有 `headers()` 方法下方添加 `redirects()` 方法：

```js
  async redirects() {
    return [
      {
        source: '/songs/generate',
        destination: '/songs/new',
        permanent: true,
      },
    ]
  },
```

完整修改后的 next.config.js 中 nextConfig 对象应为：

```js
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob: http://127.0.0.1:54321",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 https://*.sentry.io https://*.ingest.sentry.io",
              "media-src 'self' data: https://*.supabase.co http://127.0.0.1:54321",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/songs/generate',
        destination: '/songs/new',
        permanent: true,
      },
    ]
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.js
git commit -m "chore: add redirect from /songs/generate to /songs/new"
```

---

## Task 2: 重写 `/songs/new` 页面为 AI 生成表单

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/new/page.tsx`

- [ ] **Step 1: 将页面完全替换为 AI 生成表单**

将 `apps/web/src/app/[locale]/songs/new/page.tsx` 内容替换为：

```tsx
'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

type CompositionMode = 'instrumental' | 'auto_lyrics' | 'existing_lyric'

export default function NewSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [mode, setMode] = React.useState<CompositionMode>('auto_lyrics')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [lyricId, setLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  const LANGUAGE_OPTIONS = [
    { value: '', label: t('languageUnlimited') },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ]

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(t('error.emptyPrompt'))
      return
    }
    if (mode === 'existing_lyric' && !lyricId) {
      setError(t('error.noLyricSelected'))
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          language: language || undefined,
          mode,
          lyric_id: mode === 'existing_lyric' ? lyricId : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setGenerating(false)
    }
  }

  const modeOptions: { value: CompositionMode; labelKey: string; descKey: string; emoji: string }[] = [
    { value: 'instrumental', labelKey: 'mode.instrumental.label', descKey: 'mode.instrumental.desc', emoji: '🎵' },
    { value: 'auto_lyrics', labelKey: 'mode.auto_lyrics.label', descKey: 'mode.auto_lyrics.desc', emoji: '✍️' },
    { value: 'existing_lyric', labelKey: 'mode.existing_lyric.label', descKey: 'mode.existing_lyric.desc', emoji: '📝' },
  ]

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-6">
        <div>
          <Label htmlFor="prompt">{t('fields.prompt')} *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('placeholders.prompt')}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">{t('fields.genre')}</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={t('placeholders.genre')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="language">{t('fields.language')}</Label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label className="mb-2 block">{t('fields.mode')} *</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  mode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                />
                <div className="text-lg">{opt.emoji}</div>
                <div className="mt-1 font-medium">{t(opt.labelKey as any)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t(opt.descKey as any)}</div>
              </label>
            ))}
          </div>
        </div>

        {mode === 'existing_lyric' && (
          <div>
            <Label htmlFor="lyric">{t('selectLyric')} *</Label>
            <select
              id="lyric"
              value={lyricId}
              onChange={(e) => setLyricId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('selectLyric')}</option>
              {lyrics.map((lyric) => (
                <option key={lyric.id} value={lyric.id}>
                  {lyric.title}
                </option>
              ))}
            </select>
            {lyrics.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('noLyrics')}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating}>
          <Wand2 className="mr-1 h-4 w-4" />
          {generating ? tCommon('states.generating') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/new/page.tsx
git commit -m "feat(songs): transform /songs/new into AI generation entry point (#132)"
```

---

## Task 3: 删除 `/songs/generate` 页面

**Files:**
- Delete: `apps/web/src/app/[locale]/songs/generate/page.tsx`

- [ ] **Step 1: 删除文件**

```bash
rm apps/web/src/app/[locale]/songs/generate/page.tsx
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/generate/page.tsx
git commit -m "chore(songs): remove /songs/generate page in favor of redirect (#132)"
```

---

## Task 4: 移除 `POST /api/songs` handler

**Files:**
- Modify: `apps/web/src/app/api/songs/route.ts`

- [ ] **Step 1: 删除 POST handler 及仅被 POST 使用的辅助函数**

从 `apps/web/src/app/api/songs/route.ts` 中删除以下内容：

1. `validateString` 函数（仅被 POST 使用）
2. `MAX_TITLE_LENGTH`、`MAX_FIELD_LENGTH`、`MAX_AI_PROMPT_LENGTH` 常量（仅被 POST 使用）
3. 整个 `POST` 导出函数

保留 `GET` handler 和 `parsePaginationParams` 函数及 `DEFAULT_PAGE`/`DEFAULT_LIMIT`/`MAX_LIMIT` 常量。

修改后的文件应只包含：
- import 语句
- `DEFAULT_PAGE`/`DEFAULT_LIMIT`/`MAX_LIMIT` 常量
- `parsePaginationParams` 函数
- `GET` handler

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/songs/route.ts
git commit -m "api(songs): remove POST handler for draft creation (#132)"
```

---

## Task 5: 更新 `/api/songs` 测试 — 移除 POST 用例

**Files:**
- Modify: `apps/web/src/app/api/songs/route.test.ts`

- [ ] **Step 1: 删除所有 POST 相关测试代码**

从 `apps/web/src/app/api/songs/route.test.ts` 中删除：

1. `POST` 的 import（改为只 import `GET`）
2. `describe('POST /api/songs', ...)` 整个 block 及其内部所有 4 个 `it` 用例
3. `beforeEach` 如果仅剩 GET 测试不再需要 mock reset，可以保留或简化

修改后的文件结构应只包含：
- `describe('GET /api/songs', ...)` 及其内部的测试用例
- `POST` import 移除

- [ ] **Step 2: 运行测试验证通过**

```bash
pnpm --filter web test -- src/app/api/songs/route.test.ts
```

Expected: 所有 GET 测试通过，POST 相关测试不存在

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/songs/route.test.ts
git commit -m "test(api): remove POST tests for /api/songs (#132)"
```

---

## Task 6: 更新歌曲列表页导航按钮

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/page.tsx`

- [ ] **Step 1: 移除"新建歌曲"按钮，将"AI 作曲"指向 `/songs/new`**

在 `apps/web/src/app/[locale]/songs/page.tsx` 中，找到返回的 JSX 中按钮区域（在 `<div className="flex items-center gap-3">` 内），做以下修改：

- 将第一个 Link（"AI 作曲"）的 `href` 从 `/songs/generate` 改为 `/songs/new`
- 删除第三个 Link（"新建歌曲"，href 为 `/songs/new`，带 Plus icon）

修改后该区域应只包含两个按钮：
- "AI 作曲" → `/songs/new`（紫色按钮，Wand2 icon）
- "AI 翻唱" → `/songs/cover`（紫色按钮，Mic2 icon）

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/songs/page.tsx
git commit -m "ui(songs): unify entry buttons on song list page (#132)"
```

---

## Task 7: 更新 Dashboard 快速操作

**Files:**
- Modify: `apps/web/src/app/[locale]/dashboard/page.tsx`

- [ ] **Step 1: 合并 Dashboard 的"新建歌曲"和"AI 作曲"为单个"AI 作曲"**

在 Dashboard 页面中找到快速操作区域，将"新建歌曲"（指向 `/songs/new`）和"AI 作曲"（指向 `/songs/generate`）两个操作合并为一个"AI 作曲"操作，指向 `/songs/new`。

具体修改：删除"新建歌曲"的 Link/按钮，保留并更新"AI 作曲"的 href 为 `/songs/new`。

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/[locale]/dashboard/page.tsx
git commit -m "ui(dashboard): merge song creation quick actions (#132)"
```

---

## Task 8: 更新 i18n 文案（中文）

**Files:**
- Modify: `apps/web/messages/zh.json`

- [ ] **Step 1: 更新 `songs.list` namespace**

将 `songs.list` 中的 `new` 和 `generate` 统一为相同的文案：

```json
"list": {
  "title": "歌曲库",
  "new": "AI 作曲",
  "generate": "AI 作曲",
  "cover": "AI 翻唱"
}
```

- [ ] **Step 2: 重写 `songs.new` namespace**

将 `songs.new` 从草稿创建文案替换为 AI 作曲文案：

```json
"new": {
  "title": "AI 作曲",
  "fields": {
    "prompt": "主题描述",
    "genre": "风格（可选）",
    "mood": "情绪（可选）",
    "language": "语言（可选）",
    "mode": "创作模式"
  },
  "placeholders": {
    "prompt": "描述你想要的音乐，如：一首关于夏天的流行歌曲",
    "genre": "如：流行",
    "mood": "如：欢快"
  },
  "mode": {
    "instrumental": {
      "label": "纯音乐",
      "desc": "仅生成伴奏，无歌词"
    },
    "auto_lyrics": {
      "label": "自动写词",
      "desc": "AI 自动生成歌词并作曲"
    },
    "existing_lyric": {
      "label": "已有歌词",
      "desc": "使用已有歌词进行作曲"
    }
  },
  "languageUnlimited": "不限",
  "selectLyric": "请选择歌词",
  "noLyrics": "暂无可选歌词，请先创建歌词",
  "error": {
    "emptyPrompt": "主题描述不能为空",
    "noLyricSelected": "请选择关联歌词"
  },
  "submit": "开始创作"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json
git commit -m "i18n(zh): update song creation translations for unified AI entry (#132)"
```

---

## Task 9: 更新 i18n 文案（英文）

**Files:**
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: 更新 `songs.list` namespace**

```json
"list": {
  "title": "Songs",
  "new": "AI Compose",
  "generate": "AI Compose",
  "cover": "AI Cover"
}
```

- [ ] **Step 2: 重写 `songs.new` namespace**

```json
"new": {
  "title": "AI Compose",
  "fields": {
    "prompt": "Theme Description",
    "genre": "Genre (optional)",
    "mood": "Mood (optional)",
    "language": "Language (optional)",
    "mode": "Composition Mode"
  },
  "placeholders": {
    "prompt": "Describe the music you want, e.g. A pop song about summer",
    "genre": "e.g. Pop",
    "mood": "e.g. Cheerful"
  },
  "mode": {
    "instrumental": {
      "label": "Instrumental",
      "desc": "Generate instrumental only, no lyrics"
    },
    "auto_lyrics": {
      "label": "Auto Lyrics",
      "desc": "AI auto-generates lyrics and composes"
    },
    "existing_lyric": {
      "label": "Existing Lyric",
      "desc": "Compose using existing lyrics"
    }
  },
  "languageUnlimited": "Any",
  "selectLyric": "Select a lyric",
  "noLyrics": "No lyrics available, please create one first",
  "error": {
    "emptyPrompt": "Theme description cannot be empty",
    "noLyricSelected": "Please select a linked lyric"
  },
  "submit": "Start Composing"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/en.json
git commit -m "i18n(en): update song creation translations for unified AI entry (#132)"
```

---

## Task 10: 更新路由结构测试

**Files:**
- Modify: `apps/web/src/i18n/app-route-structure.test.ts`

- [ ] **Step 1: 从 localizedRouteFiles 中移除 `songs/generate/page.tsx`**

在 `apps/web/src/i18n/app-route-structure.test.ts` 的 `localizedRouteFiles` 数组中，删除字符串 `'songs/generate/page.tsx'`。

- [ ] **Step 2: 运行测试验证通过**

```bash
pnpm --filter web test -- src/i18n/app-route-structure.test.ts
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/app-route-structure.test.ts
git commit -m "test(i18n): remove songs/generate from route structure test (#132)"
```

---

## Task 11: 最终验证

- [ ] **Step 1: 运行全部相关测试**

```bash
pnpm --filter web test -- src/app/api/songs/route.test.ts src/app/api/songs/generate/route.test.ts src/i18n/app-route-structure.test.ts
```

Expected: 所有测试通过

- [ ] **Step 2: TypeScript 类型检查**

```bash
pnpm --filter web type-check
```

Expected: 无类型错误

- [ ] **Step 3: Lint 检查**

```bash
pnpm --filter web lint
```

Expected: 无 lint 错误

- [ ] **Step 4: Commit（如测试通过）**

如果测试全部通过，无需额外 commit（所有变更已在前面步骤中提交）。

---

## Self-Review

### Spec Coverage Check

| Spec 要求 | 对应 Task |
|----------|----------|
| `/songs/new` 改造为 AI 生成表单 | Task 2 |
| `/songs/generate` 页面删除 + 重定向 | Task 1 + Task 3 |
| `POST /api/songs` 废弃 | Task 4 |
| `POST /api/songs/generate` 保留 | 无变更（spec 要求保留） |
| 歌曲列表页导航合并 | Task 6 |
| Dashboard 快速操作合并 | Task 7 |
| i18n 文案更新 | Task 8 + Task 9 |
| 路由结构测试更新 | Task 10 |
| API 测试清理 | Task 5 |

**无遗漏。**

### Placeholder Scan

- 无 "TBD", "TODO", "implement later" 等占位符
- 无 "add appropriate error handling" 等模糊描述
- 所有代码块包含完整代码
- 所有步骤包含具体命令和预期输出

### Type Consistency

- i18n key 在页面组件、JSON 文件和测试之间一致
- API endpoint `/api/songs/generate` 未被改动，与现有测试兼容
- `CompositionMode` 类型与原 `/songs/generate/page.tsx` 一致
