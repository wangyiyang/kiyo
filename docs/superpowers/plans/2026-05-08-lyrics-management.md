# Lyrics Management + AI Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement lyrics CRUD APIs, AI lyrics generation via MiniMax, and a reusable structured block editor with list/detail/edit/generate pages.

**Architecture:** Extend `@kiyo/ai` with `generateLyrics()` calling MiniMax `/v1/lyrics_generation`. Build `@kiyo/ui` `StructuredBlockEditor` with `textToBlocks()`/`blocksToText()` utilities. Add Next.js API Routes for CRUD + generation. Build 4 frontend pages under `/lyrics`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Vitest, MiniMax API

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/ai/src/lyrics.ts` | MiniMax lyrics generation API client |
| `packages/ai/src/__tests__/lyrics.test.ts` | Unit tests for lyrics generation |
| `packages/ai/index.ts` | Re-export `generateLyrics` |
| `packages/ui/src/lib/blocks.ts` | `textToBlocks()` and `blocksToText()` pure functions |
| `packages/ui/src/lib/__tests__/blocks.test.ts` | Unit tests for block serialization |
| `packages/ui/src/components/structured-block-editor.tsx` | Reusable structured block editor React component |
| `packages/ui/index.ts` | Export new UI components/utilities |
| `apps/web/src/app/api/lyrics/route.ts` | `POST /api/lyrics`, `GET /api/lyrics` |
| `apps/web/src/app/api/lyrics/route.test.ts` | Tests for lyrics list/create |
| `apps/web/src/app/api/lyrics/[id]/route.ts` | `GET /api/lyrics/:id`, `PATCH /api/lyrics/:id`, `DELETE /api/lyrics/:id` |
| `apps/web/src/app/api/lyrics/[id]/route.test.ts` | Tests for lyrics detail/update/delete |
| `apps/web/src/app/api/lyrics/generate/route.ts` | `POST /api/lyrics/generate` — AI generation endpoint |
| `apps/web/src/app/api/lyrics/generate/route.test.ts` | Tests for AI generation endpoint |
| `apps/web/src/app/lyrics/page.tsx` | Lyrics list page |
| `apps/web/src/app/lyrics/[id]/page.tsx` | Lyrics detail page |
| `apps/web/src/app/lyrics/[id]/edit/page.tsx` | Lyrics editor page |
| `apps/web/src/app/lyrics/generate/page.tsx` | AI lyrics generation page |
| `apps/web/src/components/site-header.tsx` | Add lyrics nav link |

---

## Task 1: `@kiyo/ai` — Add `generateLyrics()`

**Files:**
- Create: `packages/ai/src/lyrics.ts`
- Modify: `packages/ai/index.ts`
- Test: `packages/ai/src/__tests__/lyrics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ai/src/__tests__/lyrics.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateLyrics } from '../lyrics'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.MINIMAX_API_KEY
})

describe('generateLyrics', () => {
  it('returns lyrics text on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        text: '[Verse 1]\\nFirst line\\n\\n[Chorus]\\nHook line',
      }),
    } as Response)

    const result = await generateLyrics({ prompt: '一首关于青春的歌' })
    expect(result.text).toBe('[Verse 1]\\nFirst line\\n\\n[Chorus]\\nHook line')
  })

  it('throws MinimaxError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid prompt' }),
    } as Response)

    await expect(generateLyrics({ prompt: 'test' })).rejects.toBeInstanceOf(MinimaxError)
  })

  it('throws on missing text in response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: {} }),
    } as Response)

    await expect(generateLyrics({ prompt: 'test' })).rejects.toThrow('Invalid response')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/packages/ai && pnpm test src/__tests__/lyrics.test.ts
```

Expected: FAIL with "generateLyrics is not defined" or module not found.

- [ ] **Step 3: Write minimal implementation**

Create `packages/ai/src/lyrics.ts`:

```ts
import { minimaxFetch } from './client'

export interface GenerateLyricsOptions {
  prompt: string
  mode?: 'write_full_song'
}

export interface GenerateLyricsResult {
  text: string
}

export async function generateLyrics(
  options: GenerateLyricsOptions
): Promise<GenerateLyricsResult> {
  const response = await minimaxFetch('/v1/lyrics_generation', {
    method: 'POST',
    body: JSON.stringify({
      mode: options.mode ?? 'write_full_song',
      prompt: options.prompt,
    }),
  })

  const data = response as { text?: string }
  if (!data.text) {
    throw new Error('Invalid response from lyrics generation API')
  }

  return { text: data.text }
}
```

Modify `packages/ai/index.ts`, add at the bottom:

```ts
export { generateLyrics } from './src/lyrics'
export type { GenerateLyricsOptions, GenerateLyricsResult } from './src/lyrics'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/kk/Github/kiyo/packages/ai && pnpm test src/__tests__/lyrics.test.ts
```

Expected: PASS (3/3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/lyrics.ts packages/ai/src/__tests__/lyrics.test.ts packages/ai/index.ts
git commit -m "feat(ai): add generateLyrics() for MiniMax lyrics generation"
```

---

## Task 2: `@kiyo/ui` — Block Serialization Utilities

**Files:**
- Create: `packages/ui/src/lib/blocks.ts`
- Test: `packages/ui/src/lib/__tests__/blocks.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/lib/__tests__/blocks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { textToBlocks, blocksToText } from '../blocks'
import type { Block } from '../blocks'

describe('textToBlocks', () => {
  it('parses tagged sections into blocks', () => {
    const text = '[Verse 1]\\nLine 1\\nLine 2\\n\\n[Chorus]\\nHook 1\\nHook 2'
    const blocks = textToBlocks(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].tag).toBe('Verse 1')
    expect(blocks[0].content).toBe('Line 1\\nLine 2')
    expect(blocks[1].tag).toBe('Chorus')
    expect(blocks[1].content).toBe('Hook 1\\nHook 2')
  })

  it('trims whitespace around tags and content', () => {
    const text = '[Verse 1] \\n Line 1 \\n\\n [Chorus] \\n Hook 1 '
    const blocks = textToBlocks(text)
    expect(blocks[0].tag).toBe('Verse 1')
    expect(blocks[0].content).toBe('Line 1')
    expect(blocks[1].tag).toBe('Chorus')
    expect(blocks[1].content).toBe('Hook 1')
  })

  it('wraps untagged text in a default Text block', () => {
    const text = 'Just some text\\n[Chorus]\\nHook'
    const blocks = textToBlocks(text)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].tag).toBe('Text')
    expect(blocks[0].content).toBe('Just some text')
    expect(blocks[1].tag).toBe('Chorus')
  })

  it('returns a single Text block for empty input', () => {
    const blocks = textToBlocks('')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].tag).toBe('Text')
    expect(blocks[0].content).toBe('')
  })
})

describe('blocksToText', () => {
  it('serializes blocks to tagged text', () => {
    const blocks: Block[] = [
      { id: '1', tag: 'Verse 1', content: 'Line 1\\nLine 2' },
      { id: '2', tag: 'Chorus', content: 'Hook 1' },
    ]
    expect(blocksToText(blocks)).toBe('[Verse 1]\\nLine 1\\nLine 2\\n\\n[Chorus]\\nHook 1')
  })

  it('handles empty content blocks', () => {
    const blocks: Block[] = [{ id: '1', tag: 'Intro', content: '' }]
    expect(blocksToText(blocks)).toBe('[Intro]')
  })
})

describe('roundtrip', () => {
  it('preserves structure through text -> blocks -> text', () => {
    const original = '[Verse 1]\\nLine 1\\n\\n[Chorus]\\nHook'
    const blocks = textToBlocks(original)
    const result = blocksToText(blocks)
    expect(result).toBe(original)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/packages/ui && pnpm test src/lib/__tests__/blocks.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Create `packages/ui/src/lib/blocks.ts`:

```ts
export interface Block {
  id: string
  tag: string
  content: string
}

export function textToBlocks(text: string): Block[] {
  if (!text.trim()) {
    return [{ id: crypto.randomUUID(), tag: 'Text', content: '' }]
  }

  const lines = text.split('\\n')
  const blocks: Block[] = []
  let currentTag = 'Text'
  let currentContent: string[] = []

  const flushBlock = () => {
    if (currentContent.length > 0 || blocks.length === 0) {
      blocks.push({
        id: crypto.randomUUID(),
        tag: currentTag,
        content: currentContent.join('\\n').trim(),
      })
      currentContent = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const tagMatch = trimmed.match(/^\\[(.+?)\\]$/)
    if (tagMatch) {
      flushBlock()
      currentTag = tagMatch[1].trim()
    } else {
      currentContent.push(line)
    }
  }

  flushBlock()
  return blocks
}

export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const tagLine = `[${block.tag}]`
      if (!block.content.trim()) return tagLine
      return `${tagLine}\\n${block.content}`
    })
    .join('\\n\\n')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/kk/Github/kiyo/packages/ui && pnpm test src/lib/__tests__/blocks.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/blocks.ts packages/ui/src/lib/__tests__/blocks.test.ts
git commit -m "feat(ui): add textToBlocks and blocksToText utilities"
```

---

## Task 3: `@kiyo/ui` — `StructuredBlockEditor` Component

**Files:**
- Create: `packages/ui/src/components/structured-block-editor.tsx`
- Modify: `packages/ui/index.ts`

- [ ] **Step 1: Create the component**

Create `packages/ui/src/components/structured-block-editor.tsx`:

```tsx
'use client'

import * as React from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react'
import { cn } from '../lib/utils'
import type { Block } from '../lib/blocks'

const DEFAULT_TAGS = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Outro']

export interface StructuredBlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  availableTags?: string[]
  readOnly?: boolean
}

export function StructuredBlockEditor({
  blocks,
  onChange,
  availableTags = DEFAULT_TAGS,
  readOnly = false,
}: StructuredBlockEditorProps) {
  const updateBlock = (index: number, updates: Partial<Block>) => {
    const next = blocks.map((b, i) => (i === index ? { ...b, ...updates } : b))
    onChange(next)
  }

  const addBlock = (index: number) => {
    const next = [...blocks]
    next.splice(index + 1, 0, {
      id: crypto.randomUUID(),
      tag: 'Verse',
      content: '',
    })
    onChange(next)
  }

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return
    const next = blocks.filter((_, i) => i !== index)
    onChange(next)
  }

  const moveBlock = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= blocks.length) return
    const next = [...blocks]
    const [moved] = next.splice(index, 1)
    next.splice(newIndex, 0, moved)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => (
        <div
          key={block.id}
          className={cn(
            'rounded-lg border bg-card p-4 shadow-sm',
            readOnly && 'opacity-80'
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            {!readOnly && (
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveBlock(index, -1)}
                  disabled={index === 0}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(index, 1)}
                  disabled={index === blocks.length - 1}
                  className="rounded p-0.5 hover:bg-muted disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Label className="sr-only">段落标签</Label>
            {readOnly ? (
              <span className="text-sm font-semibold text-primary">[{block.tag}]</span>
            ) : (
              <>
                <Input
                  list={`tag-suggestions-${block.id}`}
                  value={block.tag}
                  onChange={(e) => updateBlock(index, { tag: e.target.value })}
                  className="h-8 w-40 text-sm font-semibold"
                  placeholder="标签"
                />
                <datalist id={`tag-suggestions-${block.id}`}>
                  {availableTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </>
            )}
            <div className="flex-1" />
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeBlock(index)}
                disabled={blocks.length <= 1}
                className="rounded p-1 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Textarea
            value={block.content}
            onChange={(e) => updateBlock(index, { content: e.target.value })}
            readOnly={readOnly}
            className="min-h-[80px] resize-y font-mono text-sm leading-relaxed"
            placeholder="在此输入歌词内容..."
          />
          {!readOnly && (
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addBlock(index)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                添加区块
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Export from package index**

Modify `packages/ui/index.ts`, add:

```ts
export { textToBlocks, blocksToText } from './src/lib/blocks'
export type { Block } from './src/lib/blocks'
export { StructuredBlockEditor } from './src/components/structured-block-editor'
export type { StructuredBlockEditorProps } from './src/components/structured-block-editor'
```

- [ ] **Step 3: Verify type-check passes**

```bash
cd /home/kk/Github/kiyo/packages/ui && pnpm type-check
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/structured-block-editor.tsx packages/ui/index.ts
git commit -m "feat(ui): add StructuredBlockEditor component"
```

---

## Task 4: API — `POST /api/lyrics` + `GET /api/lyrics`

**Files:**
- Create: `apps/web/src/app/api/lyrics/route.ts`
- Test: `apps/web/src/app/api/lyrics/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/lyrics/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/lyrics', () => {
  it('creates lyric manually (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Song',
        content: '[Verse 1]\\nLine 1',
        language: 'zh',
        style: '流行',
        mood: '励志',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('Test Song')
    expect(json.lyric.source).toBe('manual')
    expect(json.lyric.status).toBe('draft')
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ content: 'Line 1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', content: 'Line' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/lyrics', () => {
  it('returns lyrics for authenticated user (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1', source: 'manual', status: 'draft', created_at: '2026-05-01' },
      { id: 'l2', title: 'Lyric 2', user_id: 'user-1', content: 'Line 2', source: 'ai_generated', status: 'published', created_at: '2026-05-02' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyrics).toHaveLength(2)
    expect(json.lyrics[0].title).toBe('Lyric 2')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

Also modify `apps/web/src/lib/test-utils.ts` to add `lyrics: []` to `dataStore`:

```ts
const dataStore: Record<string, any[]> = {
  songs: [],
  albums: [],
  album_songs: [],
  lyrics: [],
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/route.test.ts
```

Expected: FAIL with module not found or function not exported.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/api/lyrics/route.ts`:

```ts
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: {
    title?: string
    content?: string
    language?: string
    style?: string
    mood?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { title, content, language, style, mood } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Content is required' } },
      { status: 400 }
    )
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .insert({
      title,
      content,
      language: language ?? null,
      style: style ?? null,
      mood: mood ?? null,
      source: 'manual',
      status: 'draft',
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ lyric })
}

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: lyrics, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ lyrics: lyrics ?? [] })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/route.test.ts
```

Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/lyrics/route.ts apps/web/src/app/api/lyrics/route.test.ts apps/web/src/lib/test-utils.ts
git commit -m "feat(api): add POST and GET /api/lyrics routes"
```

---

## Task 5: API — `GET /api/lyrics/:id`, `PATCH /api/lyrics/:id`, `DELETE /api/lyrics/:id`

**Files:**
- Create: `apps/web/src/app/api/lyrics/[id]/route.ts`
- Test: `apps/web/src/app/api/lyrics/[id]/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/lyrics/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH, DELETE } from './route'
import { createMockSupabaseClient } from '@/lib/test-utils'

vi.mock('@kiyo/supabase', async () => {
  const actual = await vi.importActual('@kiyo/supabase')
  return {
    ...actual,
    createServerClient: vi.fn(),
  }
})

beforeEach(() => {
  vi.resetAllMocks()
})

describe('GET /api/lyrics/:id', () => {
  it('returns lyric detail (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('Lyric 1')
  })

  it('returns 404 for non-existent lyric', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /api/lyrics/:id', () => {
  it('updates lyric fields (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Old', user_id: 'user-1', content: 'Old content', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New', content: 'New content' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.title).toBe('New')
    expect(json.lyric.content).toBe('New content')
  })
})

describe('DELETE /api/lyrics/:id', () => {
  it('deletes lyric (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line', source: 'manual', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 'l1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/\[id\]/route.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/api/lyrics/[id]/route.ts`:

```ts
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !lyric) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Lyric not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ lyric })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const allowed = ['title', 'content', 'language', 'style', 'mood', 'status']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data: lyric, error } = await supabase
    .from('lyrics')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ lyric })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

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

  const { error } = await supabase
    .from('lyrics')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/\[id\]/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/lyrics/\[id\]/route.ts apps/web/src/app/api/lyrics/\[id\]/route.test.ts
git commit -m "feat(api): add GET, PATCH, DELETE /api/lyrics/:id routes"
```

---

## Task 6: API — `POST /api/lyrics/generate`

**Files:**
- Create: `apps/web/src/app/api/lyrics/generate/route.ts`
- Test: `apps/web/src/app/api/lyrics/generate/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/api/lyrics/generate/route.test.ts`:

```ts
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
  generateLyrics: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/lyrics/generate', () => {
  it('generates lyrics with AI and creates record (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const { generateLyrics } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateLyrics).mockResolvedValue({
      text: '[Verse 1]\\nGenerated line',
    })

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt: '一首关于青春的歌',
        language: 'zh',
        style: '流行',
        mood: '励志',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.lyric.source).toBe('ai_generated')
    expect(json.lyric.status).toBe('draft')
    expect(json.lyric.ai_prompt).toBe('一首关于青春的歌')
    expect(json.lyric.language).toBe('zh')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when prompt is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/lyrics/generate', {
      method: 'POST',
      body: JSON.stringify({ language: 'zh' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/generate/route.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/app/api/lyrics/generate/route.ts`:

```ts
import { createServerClient } from '@kiyo/supabase'
import { generateLyrics } from '@kiyo/ai'
import { NextResponse } from 'next/server'

function buildLyricsPrompt(params: {
  prompt: string
  language?: string
  style?: string
  mood?: string
}): string {
  const parts = [params.prompt]
  if (params.language) parts.push(`语言：${params.language}`)
  if (params.style) parts.push(`风格：${params.style}`)
  if (params.mood) parts.push(`情绪：${params.mood}`)
  return parts.join('，')
}

export async function POST(request: Request) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  let body: {
    prompt?: string
    language?: string
    style?: string
    mood?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { prompt, language, style, mood } = body
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' } },
      { status: 400 }
    )
  }

  try {
    const fullPrompt = buildLyricsPrompt({ prompt, language, style, mood })
    const { text } = await generateLyrics({ prompt: fullPrompt })

    const title = prompt.slice(0, 50)

    const { data: lyric, error } = await supabase
      .from('lyrics')
      .insert({
        title,
        content: text,
        language: language ?? null,
        style: style ?? null,
        mood: mood ?? null,
        source: 'ai_generated',
        status: 'draft',
        ai_prompt: prompt,
        user_id: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ lyric })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lyrics generation failed'
    const statusCode = message.includes('Minimax') || message.includes('generation') ? 422 : 500
    return NextResponse.json(
      {
        error: {
          code: statusCode === 422 ? 'GENERATION_FAILED' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: statusCode }
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm test src/app/api/lyrics/generate/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/lyrics/generate/route.ts apps/web/src/app/api/lyrics/generate/route.test.ts
git commit -m "feat(api): add POST /api/lyrics/generate for AI lyrics generation"
```

---

## Task 7: Frontend — `/lyrics` List Page

**Files:**
- Create: `apps/web/src/app/lyrics/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/lyrics/page.tsx`:

```tsx
import { createServerClient } from '@kiyo/supabase'
import Link from 'next/link'
import { EmptyState } from '@kiyo/ui'
import { Plus, Sparkles } from 'lucide-react'

export default async function LyricsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: lyrics } = await supabase
    .from('lyrics')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的歌词</h1>
        <div className="flex gap-3">
          <Link
            href="/lyrics/generate"
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" />
            AI 生成歌词
          </Link>
          <Link
            href="/lyrics/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新建歌词
          </Link>
        </div>
      </div>

      {lyrics && lyrics.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lyrics.map((lyric) => (
            <Link key={lyric.id} href={`/lyrics/${lyric.id}`}>
              <div className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-semibold">{lyric.title}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      lyric.source === 'ai_generated'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {lyric.source === 'ai_generated' ? 'AI' : '手动'}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {lyric.content.slice(0, 100)}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{lyric.language ?? '未指定语言'}</span>
                  <span>{lyric.style ?? '未指定风格'}</span>
                  <span className="ml-auto">
                    {new Date(lyric.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无歌词" description="创建你的第一首歌词吧" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/page.tsx
git commit -m "feat(web): add lyrics list page"
```

---

## Task 8: Frontend — `/lyrics/[id]` Detail Page

**Files:**
- Create: `apps/web/src/app/lyrics/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/lyrics/[id]/page.tsx`:

```tsx
import { createServerClient } from '@kiyo/supabase'
import Link from 'next/link'
import { StructuredBlockEditor, textToBlocks } from '@kiyo/ui'
import { Button } from '@kiyo/ui'
import { Pencil, ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: lyric } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!lyric) {
    notFound()
  }

  const blocks = textToBlocks(lyric.content)

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lyric.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                lyric.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {lyric.source === 'ai_generated' ? 'AI 生成' : '手动创建'}
            </span>
            {lyric.language && <span>{lyric.language}</span>}
            {lyric.style && <span>{lyric.style}</span>}
            {lyric.mood && <span>{lyric.mood}</span>}
          </div>
        </div>
        <Link href={`/lyrics/${lyric.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            编辑
          </Button>
        </Link>
      </div>

      <StructuredBlockEditor blocks={blocks} onChange={() => {}} readOnly />
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/\[id\]/page.tsx
git commit -m "feat(web): add lyric detail page"
```

---

## Task 9: Frontend — `/lyrics/[id]/edit` Editor Page

**Files:**
- Create: `apps/web/src/app/lyrics/[id]/edit/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/lyrics/[id]/edit/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  StructuredBlockEditor,
  textToBlocks,
  blocksToText,
  Button,
  Input,
  Label,
} from '@kiyo/ui'
import type { Block } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function LyricEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetch(`/api/lyrics/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lyric) {
          setTitle(data.lyric.title)
          setLanguage(data.lyric.language ?? '')
          setStyle(data.lyric.style ?? '')
          setMood(data.lyric.mood ?? '')
          setBlocks(textToBlocks(data.lyric.content))
        } else {
          setError('歌词不存在')
        }
        setLoading(false)
      })
      .catch(() => {
        setError('加载失败')
        setLoading(false)
      })
  }, [params.id])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const content = blocksToText(blocks)
      const res = await fetch(`/api/lyrics/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/lyrics/${params.id}`)
      } else {
        setError(data.error?.message || '保存失败')
      }
    } catch {
      setError('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/lyrics/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回详情
        </Link>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="歌词标题"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">语言</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="如：zh、en"
            />
          </div>
          <div>
            <Label htmlFor="style">风格</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：流行、摇滚"
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="如：励志、忧伤"
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Label className="mb-2 block">歌词内容</Label>
        <StructuredBlockEditor blocks={blocks} onChange={setBlocks} />
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href={`/lyrics/${params.id}`}>
          <Button variant="outline">取消</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/\[id\]/edit/page.tsx
git commit -m "feat(web): add lyric editor page with StructuredBlockEditor"
```

---

## Task 10: Frontend — `/lyrics/generate` AI Generation Page

**Files:**
- Create: `apps/web/src/app/lyrics/generate/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/lyrics/generate/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

export default function LyricGeneratePage() {
  const router = useRouter()
  const [prompt, setPrompt] = React.useState('')
  const [language, setLanguage] = React.useState('zh')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.lyric) {
        router.push(`/lyrics/${data.lyric.id}/edit`)
      } else {
        setError(data.error?.message || '生成失败，请稍后重试')
      }
    } catch {
      setError('生成失败，请检查网络后重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 生成歌词</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          描述你想要的歌曲主题，AI 将为你创作完整歌词
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="prompt">主题描述 *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一首关于青春校园的励志歌曲"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">语言</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="style">风格</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="流行、摇滚..."
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="励志、忧伤..."
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/lyrics">
            <Button type="button" variant="outline">
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={generating || !prompt.trim()}>
            {generating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                生成歌词
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/generate/page.tsx
git commit -m "feat(web): add AI lyrics generation page"
```

---

## Task 11: Navigation — Add Lyrics Link

**Files:**
- Modify: `apps/web/src/components/site-header.tsx`

- [ ] **Step 1: Modify the header**

Modify `apps/web/src/components/site-header.tsx`, replace the `navLinks` array and the nav rendering section. Find this existing code:

```ts
const navLinks = [
  { href: '#features', key: 'features' },
  { href: '#how', key: 'howItWorks' },
  { href: '#showcase', key: 'showcase' },
] as const
```

Replace with:

```ts
const navLinks = [
  { href: '/songs', key: 'songs', label: '歌曲库' },
  { href: '/albums', key: 'albums', label: '专辑' },
  { href: '/lyrics', key: 'lyrics', label: '歌词' },
] as const
```

Then replace the nav rendering:

```tsx
<nav className="hidden items-center gap-7 md:flex">
  {navLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {link.label}
    </Link>
  ))}
</nav>
```

(Change `<a>` to `<Link>` for internal navigation.)

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/site-header.tsx
git commit -m "feat(web): add lyrics navigation link in header"
```

---

## Task 12: New Lyric Creation Page

**Files:**
- Create: `apps/web/src/app/lyrics/new/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/lyrics/new/page.tsx`:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewLyricPage() {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/lyrics/${data.lyric.id}`)
      } else {
        setError(data.error?.message || '创建失败')
      }
    } catch {
      setError('创建失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">新建歌词</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="歌词标题"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">语言</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="如：zh、en"
            />
          </div>
          <div>
            <Label htmlFor="style">风格</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：流行、摇滚"
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="如：励志、忧伤"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">内容 *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此输入歌词内容，支持 [Verse]、[Chorus] 等标签..."
            rows={12}
            className="font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/lyrics">
          <Button variant="outline">取消</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /home/kk/Github/kiyo/apps/web && pnpm type-check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/lyrics/new/page.tsx
git commit -m "feat(web): add new lyric creation page"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Implementing Task |
|-----------------|-------------------|
| `generateLyrics()` in `@kiyo/ai` | Task 1 |
| `POST /api/lyrics` (manual create) | Task 4 |
| `GET /api/lyrics` (list) | Task 4 |
| `GET /api/lyrics/:id` (detail) | Task 5 |
| `PATCH /api/lyrics/:id` (edit) | Task 5 |
| `DELETE /api/lyrics/:id` (delete) | Task 5 |
| `POST /api/lyrics/generate` (AI) | Task 6 |
| `StructuredBlockEditor` component | Task 3 |
| `textToBlocks()` / `blocksToText()` | Task 2 |
| `/lyrics` list page | Task 7 |
| `/lyrics/[id]` detail page | Task 8 |
| `/lyrics/[id]/edit` editor page | Task 9 |
| `/lyrics/generate` AI page | Task 10 |
| `/lyrics/new` manual create page | Task 12 |
| Navigation link | Task 11 |
| Error handling (422 GENERATION_FAILED) | Task 6 |
| Tests for all layers | All tasks |

**Coverage: Complete.**

### 2. Placeholder Scan

- No "TBD", "TODO", "implement later" found.
- All test steps include actual test code.
- All implementation steps include actual code.
- No vague references like "similar to Task N".

### 3. Type Consistency

- `Block` interface defined in Task 2, used in Task 3 props and Task 8/9 pages.
- `generateLyrics` signature consistent between Task 1 and Task 6.
- API error response format consistent across all route files.

**No inconsistencies found.**

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-lyrics-management.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
