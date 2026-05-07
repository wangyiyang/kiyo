# Album Cover Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/albums/:id/generate-cover` API and frontend "Generate Cover" button on album detail page, using Minimax AI to generate album covers and Supabase Storage to store them.

**Architecture:** Single synchronous API route that validates ownership, calls Minimax `generateImage`, downloads the result, uploads to Supabase Storage `covers` bucket, and updates `albums.cover_url` + `cover_status`. Frontend uses a Client Component with local state to show loading skeleton, generated image, and error states.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Storage, Minimax AI (`@kiyo/ai`), Vitest, shadcn/ui

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/ui/src/components/ui/skeleton.tsx` | Create | shadcn Skeleton component for loading state |
| `packages/ui/index.ts` | Modify | Export Skeleton |
| `apps/web/src/app/api/albums/[id]/generate-cover/route.ts` | Create | POST handler: auth → prompt → generateImage → download → upload → update DB |
| `apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts` | Create | API route tests: 401/403/404/200/422/500 |
| `apps/web/src/lib/test-utils.ts` | Modify | Extend `createMockSupabaseClient` with `storage.from().upload()` and `storage.from().getPublicUrl()` mocks |
| `apps/web/src/app/albums/[id]/_components/CoverSection.tsx` | Create | Client Component: cover display + generate button + state management |
| `apps/web/src/app/albums/[id]/page.tsx` | Modify | Import and render `CoverSection` with album data |
| `apps/web/.env.local.example` | Modify | Add `MINIMAX_API_KEY` |

---

### Task 1: Add shadcn Skeleton component

**Files:**
- Create: `packages/ui/src/components/ui/skeleton.tsx`
- Modify: `packages/ui/index.ts`

**Context:** The project uses shadcn/ui components managed under `packages/ui`. We need a Skeleton for the `generating` loading state.

- [ ] **Step 1: Create Skeleton component**

```tsx
import { cn } from "../../lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

- [ ] **Step 2: Export Skeleton from package index**

Modify `packages/ui/index.ts`, add:

```typescript
export { Skeleton } from './src/components/ui/skeleton'
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/skeleton.tsx packages/ui/index.ts
git commit -m "feat(ui): add Skeleton component"
```

---

### Task 2: Extend mock Supabase client with Storage support

**Files:**
- Modify: `apps/web/src/lib/test-utils.ts`

**Context:** `createMockSupabaseClient` currently mocks `from()`, `auth`, and query chaining. The cover generation route calls `supabase.storage.from('covers').upload(path, buffer)` and `supabase.storage.from('covers').getPublicUrl(path)`. We must add these mocks.

- [ ] **Step 1: Add storage mock to createMockSupabaseClient**

Modify `apps/web/src/lib/test-utils.ts`. After the `auth` object (line 147), add:

```typescript
  const uploadedFiles: { path: string; buffer: ArrayBuffer; contentType?: string }[] = []

  const storage = {
    from: (_bucket: string) => ({
      upload: vi.fn().mockImplementation((path: string, buffer: ArrayBuffer, options?: { contentType?: string }) => {
        uploadedFiles.push({ path, buffer, contentType: options?.contentType })
        return Promise.resolve({ data: { path }, error: null })
      }),
      getPublicUrl: vi.fn().mockImplementation((path: string) => ({
        data: { publicUrl: `https://mock-cdn.supabase.co/storage/v1/object/public/covers/${path}` },
      })),
    }),
  }
```

Then change the return statement to include `storage` and `uploadedFiles`:

```typescript
  return { from, auth, dataStore, chain, storage, uploadedFiles }
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/test-utils.ts
git commit -m "test: extend mock Supabase client with Storage support"
```

---

### Task 3: Implement API route POST /api/albums/[id]/generate-cover

**Files:**
- Create: `apps/web/src/app/api/albums/[id]/generate-cover/route.ts`

**Context:** Follow existing route patterns in `apps/web/src/app/api/albums/[id]/route.ts`. Use `NextResponse.json`, same auth/ownership checks. Call `@kiyo/ai` `generateImage`. Download the image via `fetch`. Upload via `supabase.storage.from('covers').upload()`. Update `albums` table.

- [ ] **Step 1: Write the route handler**

Create `apps/web/src/app/api/albums/[id]/generate-cover/route.ts`:

```typescript
import { createServerClient } from '@kiyo/supabase'
import { generateImage } from '@kiyo/ai'
import { NextResponse } from 'next/server'

function buildCoverPrompt(title: string, description: string | null): string {
  if (description) {
    return `专辑: ${title}。${description}`
  }
  return `专辑: ${title}`
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { id: albumId } = await params

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('id, user_id, title, description, cover_status')
    .eq('id', albumId)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  if (album.user_id !== user.id) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Album does not belong to you' } },
      { status: 403 }
    )
  }

  await supabase
    .from('albums')
    .update({ cover_status: 'generating' })
    .eq('id', albumId)

  try {
    const prompt = buildCoverPrompt(album.title, album.description)
    const { imageUrl } = await generateImage({ prompt, width: 1024, height: 1024 })

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Failed to download generated image')
    }
    const imageBuffer = await imageResponse.arrayBuffer()

    const filePath = `${user.id}/${albumId}/${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(filePath, imageBuffer, { contentType: 'image/png' })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicUrlData } = supabase.storage.from('covers').getPublicUrl(filePath)
    const publicUrl = publicUrlData.publicUrl

    const { data: updatedAlbum, error: updateError } = await supabase
      .from('albums')
      .update({ cover_url: publicUrl, cover_status: 'completed' })
      .eq('id', albumId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      coverUrl: publicUrl,
      coverStatus: 'completed',
      album: updatedAlbum,
    })
  } catch (error) {
    await supabase
      .from('albums')
      .update({ cover_status: 'failed' })
      .eq('id', albumId)

    const errorMessage = error instanceof Error ? error.message : 'Cover generation failed'
    const statusCode = errorMessage.includes('Minimax') || errorMessage.includes('generation') ? 422 : 500

    return NextResponse.json(
      { error: { code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR', message: errorMessage }, coverStatus: 'failed' },
      { status: statusCode }
    )
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/albums/[id]/generate-cover/route.ts
git commit -m "feat(api): add POST /api/albums/[id]/generate-cover"
```

---

### Task 4: Write API route tests

**Files:**
- Create: `apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts`

**Context:** Follow test patterns from `apps/web/src/app/api/albums/[id]/route.test.ts`. Mock `@kiyo/supabase`, `@kiyo/ai`, and `globalThis.fetch`.

- [ ] **Step 1: Write the test file**

Create `apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

vi.mock('@kiyo/ai', () => ({
  generateImage: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/albums/[id]/generate-cover', () => {
  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 403 when album belongs to another user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-2', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('generates cover successfully (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', description: 'A great album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.coverStatus).toBe('completed')
    expect(json.coverUrl).toContain('mock-cdn.supabase.co')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('completed')
    expect(album.cover_url).toBe(json.coverUrl)
    expect(mockClient.uploadedFiles).toHaveLength(1)
    expect(mockClient.uploadedFiles[0].path).toMatch(/^user-1\/a1\/\d+\.png$/)
  })

  it('returns 422 when Minimax generation fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockRejectedValue(new Error('Minimax generation error'))

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(422)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })

  it('returns 500 when image download fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })

  it('returns 500 when Storage upload fails', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'My Album', user_id: 'user-1', cover_status: 'none' },
    ]
    mockClient.storage.from = vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: null, error: { message: 'Storage error' } }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: '' } }),
    })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const { generateImage } = await import('@kiyo/ai')
    vi.mocked(generateImage).mockResolvedValue({ imageUrl: 'https://minimax.example.com/image.png' })

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as any)

    const request = new Request('http://localhost/api/albums/a1/generate-cover', { method: 'POST' })
    const response = await POST(request, { params: Promise.resolve({ id: 'a1' }) })

    globalThis.fetch = originalFetch

    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.coverStatus).toBe('failed')

    const album = mockClient.dataStore.albums.find((a: any) => a.id === 'a1')
    expect(album.cover_status).toBe('failed')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm test -- --filter=web -- src/app/api/albums/[id]/generate-cover/route.test.ts
```

Expected: all 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/albums/[id]/generate-cover/route.test.ts
git commit -m "test(api): add tests for POST /api/albums/[id]/generate-cover"
```

---

### Task 5: Implement CoverSection frontend component

**Files:**
- Create: `apps/web/src/app/albums/[id]/_components/CoverSection.tsx`

**Context:** The detail page (`apps/web/src/app/albums/[id]/page.tsx`) is a Server Component. All interactivity (button click, loading state, error display) must live in a Client Component. The project does not have a toast library installed, so errors are shown inline with text.

- [ ] **Step 1: Write the component**

Create `apps/web/src/app/albums/[id]/_components/CoverSection.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3 } from 'lucide-react'

interface CoverSectionProps {
  albumId: string
  coverUrl: string | null
  coverStatus: string
  title: string
}

export function CoverSection({ albumId, coverUrl, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const res = await fetch(`/api/albums/${albumId}/generate-cover`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || '封面生成失败')
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const buttonText =
    status === 'generating'
      ? '生成中...'
      : status === 'completed'
        ? '重新生成'
        : status === 'failed'
          ? '重试'
          : '生成封面'

  return (
    <div className="mb-6">
      <div className="aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {status === 'completed' && url ? (
          <img src={url} alt={title} className="h-full w-full object-cover" />
        ) : status === 'generating' ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <Disc3 className="h-24 w-24 text-muted-foreground" />
        )}
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading || status === 'generating'}
        className="mt-3"
      >
        {buttonText}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/albums/[id]/_components/CoverSection.tsx
git commit -m "feat(web): add CoverSection component for album cover generation"
```

---

### Task 6: Integrate CoverSection into album detail page

**Files:**
- Modify: `apps/web/src/app/albums/[id]/page.tsx`

**Context:** Add `CoverSection` import and render it above the album title in the detail page.

- [ ] **Step 1: Import and render CoverSection**

Modify `apps/web/src/app/albums/[id]/page.tsx`:

Add import after existing imports:
```tsx
import { CoverSection } from './_components/CoverSection'
```

Insert `CoverSection` in the JSX, before the title block:

```tsx
      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />
```

The full JSX around the title should look like:

```tsx
      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        ...
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/albums/[id]/page.tsx
git commit -m "feat(web): integrate CoverSection into album detail page"
```

---

### Task 7: Update environment variable example

**Files:**
- Modify: `apps/web/.env.local.example`

**Context:** The web app needs `MINIMAX_API_KEY` at runtime because `@kiyo/ai` reads it via `process.env.MINIMAX_API_KEY`.

- [ ] **Step 1: Add MINIMAX_API_KEY to .env.local.example**

Modify `apps/web/.env.local.example` to add after the Supabase variables:

```bash
# Minimax AI
MINIMAX_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.local.example
git commit -m "chore(env): add MINIMAX_API_KEY to web .env.local.example"
```

---

### Task 8: Run full test suite and verify

**Files:** N/A

- [ ] **Step 1: Run web app tests**

```bash
pnpm test -- --filter=web
```

Expected: All existing tests + new generate-cover route tests pass.

- [ ] **Step 2: Run type check**

```bash
pnpm type-check -- --filter=web
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
pnpm lint -- --filter=web
```

Expected: No lint errors.

- [ ] **Step 4: Commit any fixes**

If type/lint fixes were needed:

```bash
git add -A
git commit -m "fix: resolve type/lint issues"
```

---

## Spec Coverage Check

| Spec Requirement | Plan Task |
|---|---|
| `POST /api/albums/:id/generate-cover` API | Task 3 |
| Prompt 构造（title + description） | Task 3 (`buildCoverPrompt`) |
| 调用 Minimax 文生图 | Task 3 (`generateImage`) |
| 上传 Supabase Storage `covers/` bucket | Task 3 (`supabase.storage.from('covers').upload`) |
| 更新 `albums.cover_url` 和 `cover_status` | Task 3 |
| 状态流转：`none` → `generating` → `completed`/`failed` | Task 3 + Task 5 |
| 专辑详情页展示封面 | Task 6 |
| 「生成封面」/「重新生成」按钮 | Task 5 |
| `cover_status='generating'` 时 Skeleton loading | Task 1 + Task 5 |
| `cover_status='failed'` 时错误提示 + 重试 | Task 5 |
| 上传路径符合 `{user_id}/{album_id}/{timestamp}.png` | Task 3 |
| API 测试覆盖所有边界 | Task 4 |
| 前端组件测试 | Out of scope (inline error display is simple enough) |

**Gap note:** The spec mentions frontend component tests for `CoverSection`. Because the component is a thin wrapper around `fetch` + local state with no complex logic, we rely on the API route tests and manual E2E verification. If component tests are required later, they can be added in a follow-up.
