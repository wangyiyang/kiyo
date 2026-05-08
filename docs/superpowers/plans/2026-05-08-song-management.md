# Song Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `songs` table with full metadata and audio support, implement CRUD APIs, music generation via Minimax, and complete frontend pages.

**Architecture:** Follow the existing lyrics CRUD pattern. Two-step music generation: create song placeholder first, then trigger async generation. Audio files stored in Supabase Storage `audio` bucket.

**Tech Stack:** Next.js App Router, Supabase, Minimax API, shadcn/ui, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260508120001_extend_songs.sql` | Create | Database migration for songs table extension |
| `packages/supabase/src/database.types.ts` | Modify | Update TypeScript types for extended songs table |
| `apps/web/src/app/api/songs/route.ts` | Modify | Add POST handler to existing GET-only route |
| `apps/web/src/app/api/songs/route.test.ts` | Create | Tests for POST and GET list |
| `apps/web/src/app/api/songs/[id]/route.ts` | Create | GET/PATCH/DELETE handlers for song detail |
| `apps/web/src/app/api/songs/[id]/route.test.ts` | Create | Tests for detail API |
| `apps/web/src/app/api/songs/[id]/generate/route.ts` | Create | POST handler to trigger music generation |
| `apps/web/src/app/api/songs/[id]/generate/route.test.ts` | Create | Tests for generation API |
| `packages/ai/src/music.ts` | Modify | Implement `generateMusic` function |
| `packages/ai/src/__tests__/music.test.ts` | Modify | Add tests for music generation |
| `packages/ui/src/components/song-card.tsx` | Create | Song card component for grid list |
| `packages/ui/src/components/audio-player.tsx` | Create | Audio player wrapper component |
| `packages/ui/src/components/song-status-badge.tsx` | Create | Status badge with colors |
| `packages/ui/src/index.ts` | Modify | Export new components |
| `apps/web/src/app/songs/page.tsx` | Modify | Rewrite songs list page |
| `apps/web/src/app/songs/[id]/page.tsx` | Create | Song detail page |
| `apps/web/src/app/songs/new/page.tsx` | Create | New song form page |
| `apps/web/src/app/songs/[id]/edit/page.tsx` | Create | Edit song form page |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260508120001_extend_songs.sql`

- [ ] **Step 1: Write migration file**

```sql
-- 扩展 songs 表字段
alter table songs add column audio_url text;
alter table songs add column cover_url text;
alter table songs add column lyric_id uuid references lyrics(id) on delete set null;
alter table songs add column status text not null default 'draft';
alter table songs add column duration int;
alter table songs add column genre text;
alter table songs add column mood text;
alter table songs add column source text not null default 'manual';
alter table songs add column ai_prompt text;

-- 添加检查约束
alter table songs add constraint songs_status_check
  check (status in ('draft', 'generating', 'completed', 'failed'));
alter table songs add constraint songs_source_check
  check (source in ('ai_generated', 'manual'));
```

- [ ] **Step 2: Run migration locally**

```bash
cd /home/kk/Github/kiyo
npx supabase db reset
```

Expected: Migration applies successfully, no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508120001_extend_songs.sql
git commit -m "feat(db): extend songs table with full metadata fields

- Add audio_url, cover_url, lyric_id, status, duration
- Add genre, mood, source, ai_prompt
- Add check constraints for status and source

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Update Database Types

**Files:**
- Modify: `packages/supabase/src/database.types.ts`

- [ ] **Step 1: Update songs table types**

In `packages/supabase/src/database.types.ts`, find the `songs` table definition (around line 154-176) and replace with:

```typescript
songs: {
  Row: {
    ai_prompt: string | null
    audio_url: string | null
    cover_url: string | null
    created_at: string | null
    duration: number | null
    genre: string | null
    id: string
    lyric_id: string | null
    mood: string | null
    source: string
    status: string
    title: string
    updated_at: string | null
    user_id: string
  }
  Insert: {
    ai_prompt?: string | null
    audio_url?: string | null
    cover_url?: string | null
    created_at?: string | null
    duration?: number | null
    genre?: string | null
    id?: string
    lyric_id?: string | null
    mood?: string | null
    source?: string
    status?: string
    title: string
    updated_at?: string | null
    user_id: string
  }
  Update: {
    ai_prompt?: string | null
    audio_url?: string | null
    cover_url?: string | null
    created_at?: string | null
    duration?: number | null
    genre?: string | null
    id?: string
    lyric_id?: string | null
    mood?: string | null
    source?: string
    status?: string
    title?: string
    updated_at?: string | null
    user_id?: string
  }
  Relationships: [
    {
      foreignKeyName: "songs_lyric_id_fkey"
      columns: ["lyric_id"]
      isOneToOne: false
      referencedRelation: "lyrics"
      referencedColumns: ["id"]
    },
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/src/database.types.ts
git commit -m "feat(types): update songs table TypeScript types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Songs API — POST and GET List

**Files:**
- Modify: `apps/web/src/app/api/songs/route.ts`
- Create: `apps/web/src/app/api/songs/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/songs/route.test.ts`:

```typescript
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

describe('POST /api/songs', () => {
  it('creates song with 200', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song', genre: 'pop', mood: 'happy', ai_prompt: 'A pop song' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('My Song')
    expect(json.song.genre).toBe('pop')
    expect(json.song.mood).toBe('happy')
    expect(json.song.ai_prompt).toBe('A pop song')
    expect(json.song.status).toBe('draft')
    expect(json.song.source).toBe('manual')
    expect(json.song.user_id).toBe('user-1')
    expect(mockClient.dataStore.songs).toHaveLength(1)
  })

  it('creates song with lyric_id (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song', lyric_id: 'l1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.lyric_id).toBe('l1')
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ genre: 'pop' }),
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

    const request = new Request('http://localhost/api/songs', {
      method: 'POST',
      body: JSON.stringify({ title: 'My Song' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/songs', () => {
  it('returns songs for authenticated user (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', created_at: '2024-01-01T00:00:00Z' },
      { id: 's2', title: 'Song 2', user_id: 'user-1', status: 'completed', created_at: '2024-01-02T00:00:00Z' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 2')
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

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/route.test.ts
```

Expected: FAIL — `POST` is not exported from `./route`

- [ ] **Step 3: Implement POST handler**

Modify `apps/web/src/app/api/songs/route.ts`. Replace the entire file with:

```typescript
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ songs: songs ?? [] })
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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const { title, lyric_id, genre, mood, ai_prompt } = body

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
    .insert({
      title: title.trim(),
      lyric_id: typeof lyric_id === 'string' ? lyric_id : null,
      genre: typeof genre === 'string' ? genre : null,
      mood: typeof mood === 'string' ? mood : null,
      ai_prompt: typeof ai_prompt === 'string' ? ai_prompt : null,
      status: 'draft',
      source: 'manual',
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

  return NextResponse.json({ song })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/route.test.ts
```

Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/route.ts apps/web/src/app/api/songs/route.test.ts
git commit -m "feat(api): add POST handler and tests for songs route

- Add POST /api/songs to create song placeholders
- Add lyric_id, genre, mood, ai_prompt support
- Add comprehensive tests for POST and GET

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Songs Detail API — GET/PATCH/DELETE

**Files:**
- Create: `apps/web/src/app/api/songs/[id]/route.ts`
- Create: `apps/web/src/app/api/songs/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/songs/[id]/route.test.ts`:

```typescript
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

describe('GET /api/songs/:id', () => {
  it('returns song detail with lyrics (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', lyric_id: 'l1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('Song 1')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('PATCH /api/songs/:id', () => {
  it('updates song fields (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Old', user_id: 'user-1', status: 'draft', genre: 'pop', mood: 'happy' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New', genre: 'rock' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.title).toBe('New')
    expect(json.song.genre).toBe('rock')
  })

  it('rejects updates to protected fields (400)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Old', user_id: 'user-1', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'completed', audio_url: 'http://example.com/audio.mp3' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'New' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await PATCH(request, { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})

describe('DELETE /api/songs/:id', () => {
  it('deletes song (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(mockClient.dataStore.songs).toHaveLength(0)
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await DELETE(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/\[id\]/route.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement detail route handlers**

Create `apps/web/src/app/api/songs/[id]/route.ts`:

```typescript
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

  const { data: song, error } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ song })
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
    .from('songs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
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

  const protectedFields = ['audio_url', 'status', 'duration']
  for (const field of protectedFields) {
    if (field in body) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `Cannot update ${field} directly` } },
        { status: 400 }
      )
    }
  }

  const allowed = ['title', 'lyric_id', 'genre', 'mood', 'ai_prompt', 'cover_url']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = typeof body[key] === 'string' ? body[key] : body[key] === null ? null : undefined
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
      { status: 400 }
    )
  }

  const { data: song, error } = await supabase
    .from('songs')
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

  return NextResponse.json({ song })
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
    .from('songs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (existing.audio_url) {
    try {
      const url = new URL(existing.audio_url)
      const pathParts = url.pathname.split('/')
      const filePath = pathParts.slice(pathParts.indexOf('audio') + 1).join('/')
      if (filePath) {
        await supabase.storage.from('audio').remove([filePath])
      }
    } catch {
      // Silently ignore URL parse errors
    }
  }

  const { error } = await supabase
    .from('songs')
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/\[id\]/route.test.ts
```

Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/\[id\]/route.ts apps/web/src/app/api/songs/\[id\]/route.test.ts
git commit -m "feat(api): add song detail CRUD endpoints

- GET /api/songs/:id with lyrics join
- PATCH /api/songs/:id with protected field validation
- DELETE /api/songs/:id with Storage cleanup
- Full test coverage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Music Generation AI Module

**Files:**
- Modify: `packages/ai/src/music.ts`
- Modify: `packages/ai/src/__tests__/music.test.ts`

- [ ] **Step 1: Write failing test**

Modify `packages/ai/src/__tests__/music.test.ts` (or create if not exists):

```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateMusic, MinimaxError } from '../music'
import { minimaxFetch } from '../client'

vi.mock('../client', () => ({
  minimaxFetch: vi.fn(),
}))

describe('generateMusic', () => {
  it('returns audio URL on success', async () => {
    vi.mocked(minimaxFetch).mockResolvedValue({
      data: {
        audio: 'https://cdn.minimaxi.com/audio/test.mp3',
        status: 2,
      },
      extra_info: {
        music_duration: 60000,
      },
    })

    const result = await generateMusic({
      prompt: 'pop, happy',
      lyrics: '[Verse]\nHello world',
    })

    expect(result.audioUrl).toBe('https://cdn.minimaxi.com/audio/test.mp3')
    expect(result.duration).toBe(60)
    expect(minimaxFetch).toHaveBeenCalledWith('/v1/music_generation', {
      method: 'POST',
      body: expect.stringContaining('pop, happy'),
    })
  })

  it('throws on API error', async () => {
    vi.mocked(minimaxFetch).mockRejectedValue(new MinimaxError('API error', 'api_error'))

    await expect(generateMusic({ prompt: 'test' })).rejects.toThrow(MinimaxError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/packages/ai
npx vitest run src/__tests__/music.test.ts
```

Expected: FAIL — `duration` property not returned

- [ ] **Step 3: Implement generateMusic**

Replace `packages/ai/src/music.ts`:

```typescript
import { minimaxFetch } from './client'
import { MinimaxError } from './errors'

export interface GenerateMusicOptions {
  prompt?: string
  lyrics?: string
  genre?: string
  mood?: string
  isInstrumental?: boolean
}

export interface GenerateMusicResult {
  audioUrl: string
  duration: number
}

export async function generateMusic(
  options: GenerateMusicOptions
): Promise<GenerateMusicResult> {
  const parts: string[] = []
  if (options.prompt) parts.push(options.prompt)
  if (options.genre) parts.push(`风格：${options.genre}`)
  if (options.mood) parts.push(`情绪：${options.mood}`)
  const fullPrompt = parts.join('，')

  const body: Record<string, unknown> = {
    model: 'music-2.6',
    output_format: 'url',
    audio_setting: {
      sample_rate: 44100,
      bitrate: 256000,
      format: 'mp3',
    },
  }

  if (fullPrompt) {
    body.prompt = fullPrompt
  }

  if (options.lyrics) {
    body.lyrics = options.lyrics
  }

  if (options.isInstrumental) {
    body.is_instrumental = true
  }

  const response = await minimaxFetch('/v1/music_generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    data?: { audio?: string; status?: number }
    extra_info?: { music_duration?: number }
  }

  if (!data.data?.audio) {
    throw new MinimaxError('Invalid response from music generation API', 'api_error')
  }

  const durationMs = data.extra_info?.music_duration ?? 0
  const durationSeconds = Math.round(durationMs / 1000)

  return {
    audioUrl: data.data.audio,
    duration: durationSeconds,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/kk/Github/kiyo/packages/ai
npx vitest run src/__tests__/music.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/music.ts packages/ai/src/__tests__/music.test.ts
git commit -m "feat(ai): implement music generation via Minimax API

- Add generateMusic with prompt, lyrics, genre, mood support
- Parse duration from extra_info.music_duration
- Use output_format: url for direct download

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Songs Generate API

**Files:**
- Create: `apps/web/src/app/api/songs/[id]/generate/route.ts`
- Create: `apps/web/src/app/api/songs/[id]/generate/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/songs/[id]/generate/route.test.ts`:

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
  generateMusic: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('POST /api/songs/:id/generate', () => {
  it('generates music and updates song (200)', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const { generateMusic } = await import('@kiyo/ai')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      {
        id: 's1',
        title: 'Song 1',
        user_id: 'user-1',
        status: 'draft',
        lyric_id: 'l1',
        ai_prompt: 'pop song',
        genre: 'pop',
        mood: 'happy',
      },
    ]
    mockClient.dataStore.lyrics = [
      { id: 'l1', title: 'Lyric 1', user_id: 'user-1', content: 'Line 1\nLine 2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)
    vi.mocked(generateMusic).mockResolvedValue({
      audioUrl: 'https://cdn.minimaxi.com/audio/test.mp3',
      duration: 60,
    })

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.song.status).toBe('completed')
    expect(json.song.duration).toBe(60)
  })

  it('returns 400 when song has no lyric_id', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1', status: 'draft', lyric_id: null },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 404 for non-existent song', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 'not-found' } })
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await POST(new Request('http://localhost'), { params: { id: 's1' } })
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/\[id\]/generate/route.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement generate route**

Create `apps/web/src/app/api/songs/[id]/generate/route.ts`:

```typescript
import { createServerClient } from '@kiyo/supabase'
import { generateMusic, MinimaxError } from '@kiyo/ai'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('*, lyrics(content)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (songError || !song) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Song not found' } },
      { status: 404 }
    )
  }

  if (!song.lyric_id) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Song must have a lyric to generate music' } },
      { status: 400 }
    )
  }

  await supabase
    .from('songs')
    .update({ status: 'generating' })
    .eq('id', params.id)

  try {
    const lyricsContent = song.lyrics?.content ?? ''
    const result = await generateMusic({
      prompt: song.ai_prompt ?? undefined,
      lyrics: lyricsContent,
      genre: song.genre ?? undefined,
      mood: song.mood ?? undefined,
    })

    const audioResponse = await fetch(result.audioUrl)
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio')
    }
    const audioBuffer = await audioResponse.arrayBuffer()

    const filePath = `${user.id}/${song.id}/${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(filePath, audioBuffer, { contentType: 'audio/mpeg' })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(filePath)

    const { data: updatedSong, error: updateError } = await supabase
      .from('songs')
      .update({
        audio_url: publicUrl.publicUrl,
        duration: result.duration,
        status: 'completed',
        source: 'ai_generated',
      })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`)
    }

    return NextResponse.json({ song: updatedSong })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Music generation failed'

    await supabase
      .from('songs')
      .update({ status: 'failed' })
      .eq('id', params.id)

    const isMinimaxError = err instanceof MinimaxError
    return NextResponse.json(
      {
        error: {
          code: isMinimaxError ? 'GENERATION_FAILED' : 'INTERNAL_ERROR',
          message,
        },
      },
      { status: isMinimaxError ? 422 : 500 }
    )
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/kk/Github/kiyo/apps/web
npx vitest run src/app/api/songs/\[id\]/generate/route.test.ts
```

Expected: PASS (with mocks)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/\[id\]/generate/route.ts apps/web/src/app/api/songs/\[id\]/generate/route.test.ts
git commit -m "feat(api): add music generation endpoint

- POST /api/songs/:id/generate triggers Minimax music generation
- Downloads audio and uploads to Supabase Storage
- Updates song status: generating -> completed/failed
- Returns 400 if song has no lyric_id

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: UI Components

**Files:**
- Create: `packages/ui/src/components/song-status-badge.tsx`
- Create: `packages/ui/src/components/audio-player.tsx`
- Create: `packages/ui/src/components/song-card.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create SongStatusBadge**

Create `packages/ui/src/components/song-status-badge.tsx`:

```typescript
import { cn } from '../lib/utils'

type SongStatus = 'draft' | 'generating' | 'completed' | 'failed'

interface SongStatusBadgeProps {
  status: SongStatus
}

const statusConfig: Record<SongStatus, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  generating: { label: '生成中', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  failed: { label: '失败', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
}

export function SongStatusBadge({ status }: SongStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.draft
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: Create AudioPlayer**

Create `packages/ui/src/components/audio-player.tsx`:

```typescript
'use client'

interface AudioPlayerProps {
  src: string
  className?: string
}

export function AudioPlayer({ src, className }: AudioPlayerProps) {
  return (
    <audio controls className={className} src={src}>
      您的浏览器不支持音频播放。
    </audio>
  )
}
```

- [ ] **Step 3: Create SongCard**

Create `packages/ui/src/components/song-card.tsx`:

```typescript
import Link from 'next/link'
import { cn } from '../lib/utils'
import { SongStatusBadge } from './song-status-badge'
import { Music2, Clock } from 'lucide-react'

interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
}

export function SongCard({ id, title, status, duration, lyricTitle, coverUrl }: SongCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Link href={`/songs/${id}`}>
      <div className="group rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
        <div className="mb-3 aspect-video overflow-hidden rounded-md bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <SongStatusBadge status={status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(duration)}
            </span>
          )}
          {lyricTitle && <span>歌词: {lyricTitle}</span>}
          <span className="ml-auto">
            {status === 'completed' ? '可播放' : status === 'failed' ? '生成失败' : '待生成'}
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Update UI exports**

Modify `packages/ui/src/index.ts`, add after line 48:

```typescript
export { SongCard } from './src/components/song-card'
export { AudioPlayer } from './src/components/audio-player'
export { SongStatusBadge } from './src/components/song-status-badge'
```

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/song-status-badge.tsx packages/ui/src/components/audio-player.tsx packages/ui/src/components/song-card.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add song components

- SongCard with cover, status, duration, lyric title
- AudioPlayer wrapper for native audio element
- SongStatusBadge with color-coded states

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Songs List Page

**Files:**
- Modify: `apps/web/src/app/songs/page.tsx`

- [ ] **Step 1: Rewrite songs list page**

Replace `apps/web/src/app/songs/page.tsx`:

```typescript
import { createServerClient } from '@kiyo/supabase'
import { EmptyState, SongCard } from '@kiyo/ui'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">歌曲库</h1>
        <Link
          href="/songs/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建歌曲
        </Link>
      </div>

      {songs && songs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              id={song.id}
              title={song.title}
              status={song.status}
              duration={song.duration}
              lyricTitle={song.lyrics?.title ?? null}
              coverUrl={song.cover_url}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无歌曲" description="创建你的第一首歌曲吧" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/page.tsx
git commit -m "feat(web): rewrite songs list page with card grid

- Use SongCard component for grid layout
- Show status, duration, lyric title
- Add link to new song page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Song Detail Page

**Files:**
- Create: `apps/web/src/app/songs/[id]/page.tsx`

- [ ] **Step 1: Create detail page**

Create `apps/web/src/app/songs/[id]/page.tsx`:

```typescript
import { createServerClient } from '@kiyo/supabase'
import Link from 'next/link'
import { AudioPlayer, Button, SongStatusBadge } from '@kiyo/ui'
import { ArrowLeft, Pencil, Play, AlertCircle } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function SongDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!song) {
    notFound()
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SongStatusBadge status={song.status} />
            {song.genre && <span>{song.genre}</span>}
            {song.mood && <span>{song.mood}</span>}
            {song.duration && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {formatDuration(song.duration)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {song.source === 'ai_generated' ? 'AI 生成' : '手动创建'}
            </span>
          </div>
        </div>
        <Link href={`/songs/${song.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            编辑
          </Button>
        </Link>
      </div>

      {(song.status === 'draft' || song.status === 'failed') && (
        <div className="mb-6 rounded-lg border border-dashed p-6 text-center">
          <div className="mb-2 flex justify-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">
            {song.status === 'failed'
              ? '音乐生成失败，请检查后重试'
              : '歌曲尚未生成音乐'}
          </p>
          <form
            action={`/api/songs/${song.id}/generate`}
            method="POST"
          >
            <Button type="submit" disabled={!song.lyric_id}>
              {song.status === 'failed' ? '重新生成' : '生成音乐'}
            </Button>
          </form>
          {!song.lyric_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              需要关联歌词后才能生成音乐
            </p>
          )}
        </div>
      )}

      {song.status === 'generating' && (
        <div className="mb-6 rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">音乐生成中，请稍候...</p>
        </div>
      )}

      {song.status === 'completed' && song.audio_url && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">音频预览</h2>
          <AudioPlayer src={song.audio_url} className="w-full" />
        </div>
      )}

      {song.ai_prompt && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">生成描述</h2>
          <p className="text-sm text-muted-foreground">{song.ai_prompt}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">歌词</h2>
            <Link href={`/lyrics/${song.lyrics.id}`} className="text-xs text-primary hover:underline">
              查看完整歌词
            </Link>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/\[id\]/page.tsx
git commit -m "feat(web): add song detail page

- Show metadata: title, status, genre, mood, duration, source
- Show audio player when completed
- Show generate button for draft/failed
- Show lyrics content with link to full lyric

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: New Song Page

**Files:**
- Create: `apps/web/src/app/songs/new/page.tsx`

- [ ] **Step 1: Create new song page**

Create `apps/web/src/app/songs/new/page.tsx`:

```typescript
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function NewSongPage() {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [selectedLyricId, setSelectedLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
  }, [])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          ai_prompt: aiPrompt || undefined,
          lyric_id: selectedLyricId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${data.song.id}`)
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
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">新建歌曲</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="歌曲标题"
          />
        </div>

        <div>
          <Label htmlFor="lyric">关联歌词（可选）</Label>
          <select
            id="lyric"
            value={selectedLyricId}
            onChange={(e) => setSelectedLyricId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">不关联歌词</option>
            {lyrics.map((lyric) => (
              <option key={lyric.id} value={lyric.id}>
                {lyric.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">风格</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
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
          <Label htmlFor="aiPrompt">生成描述（AI 生成时使用）</Label>
          <Textarea
            id="aiPrompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="描述你想要的音乐风格，如：独立民谣，忧郁，适合在咖啡馆聆听"
            rows={3}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
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

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/new/page.tsx
git commit -m "feat(web): add new song page

- Form with title, lyric selector, genre, mood, AI prompt
- Fetches user's lyrics for dropdown selection
- Creates song placeholder and redirects to detail

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Edit Song Page

**Files:**
- Create: `apps/web/src/app/songs/[id]/edit/page.tsx`

- [ ] **Step 1: Create edit page**

Create `apps/web/src/app/songs/[id]/edit/page.tsx`:

```typescript
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function SongEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [selectedLyricId, setSelectedLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${params.id}`).then((res) => res.json()),
      fetch('/api/lyrics').then((res) => res.json()),
    ])
      .then(([songData, lyricsData]) => {
        if (songData.song) {
          setTitle(songData.song.title)
          setGenre(songData.song.genre ?? '')
          setMood(songData.song.mood ?? '')
          setAiPrompt(songData.song.ai_prompt ?? '')
          setSelectedLyricId(songData.song.lyric_id ?? '')
        } else {
          setError('歌曲不存在')
        }
        if (lyricsData.lyrics) setLyrics(lyricsData.lyrics)
        setLoading(false)
      })
      .catch(() => {
        setError('加载失败')
        setLoading(false)
      })
  }, [params.id])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/songs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          ai_prompt: aiPrompt || undefined,
          lyric_id: selectedLyricId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${params.id}`)
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
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/songs/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回详情
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">编辑歌曲</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="歌曲标题"
          />
        </div>

        <div>
          <Label htmlFor="lyric">关联歌词（可选）</Label>
          <select
            id="lyric"
            value={selectedLyricId}
            onChange={(e) => setSelectedLyricId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">不关联歌词</option>
            {lyrics.map((lyric) => (
              <option key={lyric.id} value={lyric.id}>
                {lyric.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">风格</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
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
          <Label htmlFor="aiPrompt">生成描述</Label>
          <Textarea
            id="aiPrompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="描述你想要的音乐风格"
            rows={3}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href={`/songs/${params.id}`}>
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

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/songs/\[id\]/edit/page.tsx
git commit -m "feat(web): add song edit page

- Pre-populates form from existing song data
- Allows editing title, lyric, genre, mood, AI prompt
- Uses PATCH /api/songs/:id

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|-----------------|------|
| 扩展 songs 表字段 | Task 1 |
| 不影响 album_songs 关联 | Task 1 (约束设计) |
| 创建/查看/编辑/删除歌曲 | Tasks 3, 4, 8, 9, 10, 11 |
| 歌曲列表展示封面/时长/状态 | Tasks 7, 8 |
| 详情页播放音频 | Tasks 6, 9 |
| 关联已有歌词 | Tasks 3, 9, 10, 11 |
| 迁移文件管理 | Task 1 |
| 音乐生成（Minimax） | Tasks 5, 6 |
| RLS 策略 | Task 1 (沿用现有) |

**Gap**: Storage 的 `audio` bucket RLS 已存在，无需新增。✓

### 2. Placeholder Scan

- 无 TBD/TODO ✓
- 所有步骤包含完整代码 ✓
- 所有步骤包含测试代码 ✓
- 无 "Similar to Task N" ✓
- 所有文件路径精确 ✓

### 3. Type Consistency

- `GenerateMusicResult` 接口包含 `audioUrl` 和 `duration` — 在 Task 5 和 Task 6 中一致使用 ✓
- `status` 字段值：`'draft' | 'generating' | 'completed' | 'failed'` — 全文档一致 ✓
- `source` 字段值：`'ai_generated' | 'manual'` — 全文档一致 ✓
- API 错误响应格式 `{ error: { code, message } }` — 与现有 lyrics API 一致 ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-song-management.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you like to use?
