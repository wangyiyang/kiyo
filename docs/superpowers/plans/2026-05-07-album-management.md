# Album Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement album CRUD APIs and frontend pages, including song library page, album list/detail pages, and drag-to-reorder song order within albums.

**Architecture:** Route Handlers + Server/Client hybrid. List pages use Server Components querying Supabase directly. Dialogs, forms, and drag-and-drop use Client Components calling REST APIs. `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, shadcn/ui, Supabase, `@dnd-kit/core`, `@dnd-kit/sortable`, vitest

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/vitest.config.ts` | Vitest configuration for the web app |
| `apps/web/src/lib/test-utils.ts` | Mock Supabase client helper for API route tests |
| `apps/web/src/app/api/songs/route.ts` | `GET /api/songs` — list current user's songs |
| `apps/web/src/app/api/songs/route.test.ts` | Tests for songs API |
| `apps/web/src/app/api/albums/route.ts` | `POST /api/albums` (create) + `GET /api/albums` (list) |
| `apps/web/src/app/api/albums/route.test.ts` | Tests for albums list/create API |
| `apps/web/src/app/api/albums/[id]/route.ts` | `GET /api/albums/[id]` (detail) + `PATCH` (update) + `DELETE` |
| `apps/web/src/app/api/albums/[id]/route.test.ts` | Tests for album detail/update/delete API |
| `packages/ui/src/components/empty-state.tsx` | Empty state placeholder component |
| `packages/ui/src/components/song-row.tsx` | Song row display component |
| `packages/ui/src/components/album-card.tsx` | Album card display component |
| `apps/web/src/app/songs/page.tsx` | Song library list page (Server Component) |
| `apps/web/src/app/albums/page.tsx` | Album list page (Server Component) |
| `apps/web/src/app/albums/[id]/page.tsx` | Album detail page with draggable song list (Server Component) |
| `apps/web/src/app/albums/_components/AlbumFormDialog.tsx` | Create/edit album dialog (Client Component) |
| `apps/web/src/app/albums/_components/SongSelector.tsx` | Song multi-select with search (Client Component) |
| `apps/web/src/app/albums/_components/DraggableSongList.tsx` | Drag-to-reorder song list (Client Component) |
| `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx` | Delete confirmation dialog (Client Component) |

### Modified files

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `vitest`, `@vitejs/plugin-react`, `jsdom` devDependencies; add `test` script |
| `packages/ui/index.ts` | Export new components: `EmptyState`, `SongRow`, `AlbumCard` |

---

## Mock Supabase Helper

The test helper creates a mock Supabase client that returns chainable query builders:

```typescript
// apps/web/src/lib/test-utils.ts
import { vi } from 'vitest'

export function createMockSupabaseClient(options: { userId?: string } = {}) {
  const dataStore: Record<string, any[]> = {
    songs: [],
    albums: [],
    album_songs: [],
  }

  let currentTable = ''
  let currentFilters: Array<(item: any) => boolean> = []
  let currentSelect = '*'
  let currentOrder: { column: string; ascending: boolean } | null = null
  let currentSingle = false
  let currentLimit: number | null = null

  const reset = () => {
    currentTable = ''
    currentFilters = []
    currentSelect = '*'
    currentOrder = null
    currentSingle = false
    currentLimit = null
  }

  const chain = {
    select: (columns = '*') => {
      currentSelect = columns
      return chain
    },
    insert: (values: any | any[]) => {
      const arr = Array.isArray(values) ? values : [values]
      arr.forEach((v) => dataStore[currentTable].push({ ...v, id: v.id || `mock-${Math.random().toString(36).slice(2)}` }))
      return { data: arr.length === 1 ? arr[0] : arr, error: null }
    },
    update: (values: any) => {
      let items = dataStore[currentTable].filter((item) => currentFilters.every((f) => f(item)))
      items.forEach((item) => Object.assign(item, values))
      return { data: items.length === 1 ? items[0] : items, error: null }
    },
    delete: () => {
      const before = dataStore[currentTable].length
      dataStore[currentTable] = dataStore[currentTable].filter((item) => !currentFilters.every((f) => f(item)))
      const deleted = before - dataStore[currentTable].length
      return { data: deleted > 0 ? { count: deleted } : null, error: null }
    },
    eq: (column: string, value: any) => {
      currentFilters.push((item) => item[column] === value)
      return chain
    },
    in: (column: string, values: any[]) => {
      currentFilters.push((item) => values.includes(item[column]))
      return chain
    },
    order: (column: string, { ascending = true } = {}) => {
      currentOrder = { column, ascending }
      return chain
    },
    limit: (n: number) => {
      currentLimit = n
      return chain
    },
    single: () => {
      currentSingle = true
      return chain
    },
    then: async (resolve: any) => {
      let result = [...dataStore[currentTable]]
      currentFilters.forEach((f) => {
        result = result.filter(f)
      })
      if (currentOrder) {
        result.sort((a, b) => {
          const dir = currentOrder!.ascending ? 1 : -1
          return a[currentOrder!.column] > b[currentOrder!.column] ? dir : -dir
        })
      }
      if (currentLimit) {
        result = result.slice(0, currentLimit)
      }
      if (currentSingle) {
        result = result[0] ?? null
      }
      reset()
      return resolve({ data: result, error: null })
    },
  }

  const from = (table: string) => {
    currentTable = table
    return chain
  }

  const auth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: options.userId ? { id: options.userId } : null },
      error: null,
    }),
  }

  return { from, auth, dataStore, chain }
}
```

---

## Task 1: Install Dependencies and Configure Vitest

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/test-utils.ts`

- [ ] **Step 1: Add devDependencies to `apps/web/package.json`**

Add these to `devDependencies`:

```json
{
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5",
    "vitest": "^2.1.9",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1"
  }
}
```

Also add to `scripts`:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Run pnpm install**

Run: `cd /home/kk/Github/kiyo && pnpm install`
Expected: Dependencies installed successfully

- [ ] **Step 3: Create `apps/web/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create `apps/web/src/lib/test-utils.ts`**

Write the `createMockSupabaseClient` helper shown in the "Mock Supabase Helper" section above.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/lib/test-utils.ts pnpm-lock.yaml
git commit -m "chore(web): add vitest and test utilities for API route testing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Create Shared UI Components

**Files:**
- Create: `packages/ui/src/components/empty-state.tsx`
- Create: `packages/ui/src/components/song-row.tsx`
- Create: `packages/ui/src/components/album-card.tsx`
- Modify: `packages/ui/index.ts`

- [ ] **Step 1: Create `packages/ui/src/components/empty-state.tsx`**

```tsx
import { Music } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Music className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `packages/ui/src/components/song-row.tsx`**

```tsx
import { Checkbox } from './ui/checkbox'

interface SongRowProps {
  id: string
  title: string
  mode: 'select' | 'drag'
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  dragHandle?: React.ReactNode
}

export function SongRow({ id, title, mode, selected, onSelect, dragHandle }: SongRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/50">
      {mode === 'select' && onSelect && (
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelect(id, checked === true)}
        />
      )}
      {mode === 'drag' && dragHandle}
      <span className="flex-1 text-sm font-medium">{title}</span>
    </div>
  )
}
```

Note: `Checkbox` may not exist yet in shadcn. If it does not exist, run `cd packages/ui && npx shadcn add checkbox` first.

- [ ] **Step 3: Create `packages/ui/src/components/album-card.tsx`**

```tsx
import { Disc3 } from 'lucide-react'

interface AlbumCardProps {
  title: string
  description?: string | null
  songCount: number
  coverUrl?: string | null
  onClick?: () => void
}

export function AlbumCard({ title, description, songCount, coverUrl, onClick }: AlbumCardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Disc3 className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-semibold leading-tight">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{songCount} 首歌曲</p>
    </div>
  )
}
```

- [ ] **Step 4: Update `packages/ui/index.ts`**

```typescript
export { cn } from './src/lib/utils'
export { Button } from './src/components/ui/button'
export { EmptyState } from './src/components/empty-state'
export { SongRow } from './src/components/song-row'
export { AlbumCard } from './src/components/album-card'
```

- [ ] **Step 5: Install lucide-react if not present and add Checkbox if missing**

Run: `cd /home/kk/Github/kiyo/packages/ui && npx shadcn add checkbox`
If lucide-react is not in dependencies, also: `pnpm add lucide-react`

- [ ] **Step 6: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=@kiyo/ui`
Expected: Pass with no errors

- [ ] **Step 7: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): add EmptyState, SongRow, AlbumCard shared components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Implement GET /api/songs

**Files:**
- Create: `apps/web/src/app/api/songs/route.ts`
- Create: `apps/web/src/app/api/songs/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/songs/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

describe('GET /api/songs', () => {
  it('returns songs for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 1')
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

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/songs/route.test.ts`
Expected: FAIL — `GET` is not exported from `./route`

- [ ] **Step 3: Implement the route handler**

Create `apps/web/src/app/api/songs/route.ts`:

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
    .select('*')
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/songs/route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/songs/
git commit -m "feat(api): add GET /api/songs endpoint with tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Implement POST /api/albums

**Files:**
- Create: `apps/web/src/app/api/albums/route.ts`
- Create: `apps/web/src/app/api/albums/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/albums/route.test.ts`:

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

function createRequest(body: object) {
  return new Request('http://localhost/api/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/albums', () => {
  it('creates album with songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createRequest({ title: 'My Album', song_ids: ['s1', 's2'] })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.title).toBe('My Album')
    expect(mockClient.dataStore.album_songs).toHaveLength(2)
  })

  it('returns 400 when title is missing', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createRequest({ song_ids: ['s1'] })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when song_ids contain songs not owned by user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createRequest({ title: 'My Album', song_ids: ['s1', 's2'] })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN_SONGS')
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = createRequest({ title: 'My Album' })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/route.test.ts`
Expected: FAIL — `POST` and `GET` not exported

- [ ] **Step 3: Implement the route handler**

Create `apps/web/src/app/api/albums/route.ts`:

```typescript
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

  const body = await request.json()
  const { title, description, song_ids } = body

  if (!title || typeof title !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Title is required' } },
      { status: 400 }
    )
  }

  // Validate song_ids ownership
  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const { data: ownedSongs } = await supabase
      .from('songs')
      .select('id')
      .eq('user_id', user.id)
      .in('id', song_ids)

    if (!ownedSongs || ownedSongs.length !== song_ids.length) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN_SONGS', message: 'Some songs do not belong to you' } },
        { status: 403 }
      )
    }
  }

  // Create album
  const { data: album, error: albumError } = await supabase
    .from('albums')
    .insert({ title, description: description || null, user_id: user.id })
    .select()
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: albumError?.message ?? 'Failed to create album' } },
      { status: 500 }
    )
  }

  // Insert album_songs with order_index
  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const albumSongs = song_ids.map((song_id: string, index: number) => ({
      album_id: album.id,
      song_id,
      order_index: index,
    }))

    const { error: songsError } = await supabase.from('album_songs').insert(albumSongs)

    if (songsError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: songsError.message } },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(album)
}
```

Note: `GET` handler for `/api/albums` will be added in Task 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/route.test.ts -t "POST"`
Expected: All POST tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/albums/route.ts apps/web/src/app/api/albums/route.test.ts
git commit -m "feat(api): add POST /api/albums with song ownership validation and tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Implement GET /api/albums

**Files:**
- Modify: `apps/web/src/app/api/albums/route.ts`
- Modify: `apps/web/src/app/api/albums/route.test.ts`

- [ ] **Step 1: Write failing test**

Add to `apps/web/src/app/api/albums/route.test.ts`:

```typescript
describe('GET /api/albums', () => {
  it('returns albums for authenticated user', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
      { id: 'a2', title: 'Album 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.albums).toHaveLength(2)
  })

  it('returns 401 when not authenticated', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: undefined })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const response = await GET()
    expect(response.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/route.test.ts -t "GET /api/albums"`
Expected: FAIL — `GET` is not exported or not implemented

- [ ] **Step 3: Implement GET handler**

Add to `apps/web/src/app/api/albums/route.ts`:

```typescript
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: albums, error } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ albums: albums ?? [] })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/albums/route.ts apps/web/src/app/api/albums/route.test.ts
git commit -m "feat(api): add GET /api/albums endpoint with tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Implement GET /api/albums/[id]

**Files:**
- Create: `apps/web/src/app/api/albums/[id]/route.ts`
- Create: `apps/web/src/app/api/albums/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/app/api/albums/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
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

describe('GET /api/albums/[id]', () => {
  it('returns album detail with songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's1', order_index: 0 },
      { album_id: 'a1', song_id: 's2', order_index: 1 },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1')
    const response = await GET(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.album.title).toBe('Album 1')
    expect(json.songs).toHaveLength(2)
    expect(json.songs[0].title).toBe('Song 1')
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/notfound')
    const response = await GET(request, { params: Promise.resolve({ id: 'notfound' }) })

    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.error.code).toBe('ALBUM_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts`
Expected: FAIL — `GET` not exported

- [ ] **Step 3: Implement the route handler**

Create `apps/web/src/app/api/albums/[id]/route.ts`:

```typescript
import { createServerClient } from '@kiyo/supabase'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: album, error: albumError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (albumError || !album) {
    return NextResponse.json(
      { error: { code: 'ALBUM_NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  const { data: albumSongs, error: songsError } = await supabase
    .from('album_songs')
    .select('*, songs(*)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  if (songsError) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: songsError.message } },
      { status: 500 }
    )
  }

  const songs = (albumSongs ?? []).map((as: any) => as.songs)

  return NextResponse.json({ album, songs })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/
git commit -m "feat(api): add GET /api/albums/[id] with songs detail and tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Implement PATCH /api/albums/[id]

**Files:**
- Modify: `apps/web/src/app/api/albums/[id]/route.ts`
- Modify: `apps/web/src/app/api/albums/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Add to `apps/web/src/app/api/albums/[id]/route.test.ts`:

```typescript
import { PATCH } from './route'

describe('PATCH /api/albums/[id]', () => {
  it('updates album and song order', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Old Title', user_id: 'user-1' },
    ]
    mockClient.dataStore.album_songs = [
      { album_id: 'a1', song_id: 's1', order_index: 0 },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', song_ids: ['s2', 's1'] }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.title).toBe('New Title')
    expect(mockClient.dataStore.album_songs).toHaveLength(2)
    const s2Entry = mockClient.dataStore.album_songs.find((x: any) => x.song_id === 's2')
    expect(s2Entry.order_index).toBe(0)
  })

  it('returns 403 when song_ids contain non-owned songs', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    mockClient.dataStore.songs = [
      { id: 's1', title: 'Song 1', user_id: 'user-1' },
      { id: 's2', title: 'Song 2', user_id: 'user-2' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song_ids: ['s1', 's2'] }),
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error.code).toBe('FORBIDDEN_SONGS')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts -t "PATCH"`
Expected: FAIL — `PATCH` not exported

- [ ] **Step 3: Implement PATCH handler**

Add to `apps/web/src/app/api/albums/[id]/route.ts`:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  // Verify album exists and belongs to user
  const { data: existingAlbum } = await supabase
    .from('albums')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existingAlbum) {
    return NextResponse.json(
      { error: { code: 'ALBUM_NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  const body = await request.json()
  const { title, description, song_ids } = body

  // Validate song_ids ownership if provided
  if (song_ids && Array.isArray(song_ids) && song_ids.length > 0) {
    const { data: ownedSongs } = await supabase
      .from('songs')
      .select('id')
      .eq('user_id', user.id)
      .in('id', song_ids)

    if (!ownedSongs || ownedSongs.length !== song_ids.length) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN_SONGS', message: 'Some songs do not belong to you' } },
        { status: 403 }
      )
    }
  }

  // Update album
  const updateData: Record<string, any> = {}
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description

  if (Object.keys(updateData).length > 0) {
    const { error: updateError } = await supabase
      .from('albums')
      .update(updateData)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: updateError.message } },
        { status: 500 }
      )
    }
  }

  // Replace album_songs if song_ids provided
  if (song_ids && Array.isArray(song_ids)) {
    const { error: deleteError } = await supabase.from('album_songs').delete().eq('album_id', id)
    if (deleteError) {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: deleteError.message } },
        { status: 500 }
      )
    }

    if (song_ids.length > 0) {
      const albumSongs = song_ids.map((song_id: string, index: number) => ({
        album_id: id,
        song_id,
        order_index: index,
      }))

      const { error: insertError } = await supabase.from('album_songs').insert(albumSongs)
      if (insertError) {
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: insertError.message } },
          { status: 500 }
        )
      }
    }
  }

  // Fetch updated album
  const { data: album, error: fetchError } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !album) {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: fetchError?.message ?? 'Failed to fetch album' } },
      { status: 500 }
    )
  }

  return NextResponse.json(album)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/route.ts apps/web/src/app/api/albums/\[id\]/route.test.ts
git commit -m "feat(api): add PATCH /api/albums/[id] with atomic song order update and tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Implement DELETE /api/albums/[id]

**Files:**
- Modify: `apps/web/src/app/api/albums/[id]/route.ts`
- Modify: `apps/web/src/app/api/albums/[id]/route.test.ts`

- [ ] **Step 1: Write failing test**

Add to `apps/web/src/app/api/albums/[id]/route.test.ts`:

```typescript
import { DELETE } from './route'

describe('DELETE /api/albums/[id]', () => {
  it('deletes album successfully', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    mockClient.dataStore.albums = [
      { id: 'a1', title: 'Album 1', user_id: 'user-1' },
    ]
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/a1')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'a1' }) })

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(mockClient.dataStore.albums).toHaveLength(0)
  })

  it('returns 404 when album not found', async () => {
    const { createServerClient } = await import('@kiyo/supabase')
    const mockClient = createMockSupabaseClient({ userId: 'user-1' })
    vi.mocked(createServerClient).mockResolvedValue(mockClient as any)

    const request = new Request('http://localhost/api/albums/notfound')
    const response = await DELETE(request, { params: Promise.resolve({ id: 'notfound' }) })

    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts -t "DELETE"`
Expected: FAIL — `DELETE` not exported

- [ ] **Step 3: Implement DELETE handler**

Add to `apps/web/src/app/api/albums/[id]/route.ts`:

```typescript
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const { data: existingAlbum } = await supabase
    .from('albums')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!existingAlbum) {
    return NextResponse.json(
      { error: { code: 'ALBUM_NOT_FOUND', message: 'Album not found' } },
      { status: 404 }
    )
  }

  const { error } = await supabase.from('albums').delete().eq('id', id)

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

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run src/app/api/albums/\[id\]/route.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/albums/\[id\]/route.ts apps/web/src/app/api/albums/\[id\]/route.test.ts
git commit -m "feat(api): add DELETE /api/albums/[id] with tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Create Song Library Page (/songs)

**Files:**
- Create: `apps/web/src/app/songs/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/songs/page.tsx`:

```tsx
import { createServerClient } from '@kiyo/supabase'
import { EmptyState, SongRow } from '@kiyo/ui'
import Link from 'next/link'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>请先登录</div>
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">歌曲库</h1>
        <Link href="/albums" className="text-sm text-primary hover:underline">
          返回专辑列表
        </Link>
      </div>

      {songs && songs.length > 0 ? (
        <div className="space-y-2">
          {songs.map((song) => (
            <SongRow key={song.id} id={song.id} title={song.title} mode="drag" />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无歌曲" description="去创作你的第一首歌曲吧" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/songs/page.tsx
git commit -m "feat(web): add song library list page at /songs

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Create Album List Page (/albums)

**Files:**
- Create: `apps/web/src/app/albums/page.tsx`
- Create: `apps/web/src/app/albums/_components/AlbumFormDialog.tsx` (skeleton — full implementation in Task 14)

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/albums/page.tsx`:

```tsx
import { createServerClient } from '@kiyo/supabase'
import { EmptyState, AlbumCard } from '@kiyo/ui'
import Link from 'next/link'

export default async function AlbumsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>请先登录</div>
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch song counts
  const albumIds = albums?.map((a) => a.id) ?? []
  let songCounts: Record<string, number> = {}

  if (albumIds.length > 0) {
    const { data: albumSongs } = await supabase
      .from('album_songs')
      .select('album_id')
      .in('album_id', albumIds)

    songCounts = (albumSongs ?? []).reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.album_id] = (acc[curr.album_id] ?? 0) + 1
      return acc
    }, {})
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">我的专辑</h1>
        <div className="flex gap-4">
          <Link
            href="/songs"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            歌曲库
          </Link>
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            新建专辑
          </button>
        </div>
      </div>

      {albums && albums.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <Link key={album.id} href={`/albums/${album.id}`}>
              <AlbumCard
                title={album.title}
                description={album.description}
                songCount={songCounts[album.id] ?? 0}
                coverUrl={album.cover_url}
              />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="暂无专辑" description="创建你的第一张专辑吧" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/albums/page.tsx
git commit -m "feat(web): add album list page at /albums

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Create Album Detail Page (/albums/[id])

**Files:**
- Create: `apps/web/src/app/albums/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/albums/[id]/page.tsx`:

```tsx
import { createServerClient } from '@kiyo/supabase'
import { EmptyState } from '@kiyo/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>请先登录</div>
  }

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(*)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/albums" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回专辑列表
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">歌曲列表</h2>
        <span className="text-sm text-muted-foreground">{songs.length} 首歌曲</span>
      </div>

      {songs.length > 0 ? (
        <div className="space-y-2">
          {songs.map((song: any, index: number) => (
            <div
              key={song.id}
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
            >
              <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}</span>
              <span className="flex-1 text-sm font-medium">{song.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/albums/\[id\]/page.tsx
git commit -m "feat(web): add album detail page at /albums/[id]

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Install @dnd-kit

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dnd-kit packages**

Run: `cd /home/kk/Github/kiyo/apps/web && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: Packages installed successfully

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): install @dnd-kit for drag-and-drop

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Create DraggableSongList Component

**Files:**
- Create: `apps/web/src/app/albums/_components/DraggableSongList.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/app/albums/_components/DraggableSongList.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface Song {
  id: string
  title: string
}

interface DraggableSongListProps {
  songs: Song[]
  albumId: string
  onReorder?: (newOrder: Song[]) => void
}

function SortableSongRow({ song, index }: { song: Song; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}</span>
      <span className="flex-1 text-sm font-medium">{song.title}</span>
    </div>
  )
}

export function DraggableSongList({ songs: initialSongs, albumId, onReorder }: DraggableSongListProps) {
  const [songs, setSongs] = useState(initialSongs)
  const [isSaving, setIsSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = songs.findIndex((s) => s.id === active.id)
    const newIndex = songs.findIndex((s) => s.id === over.id)
    const newSongs = arrayMove(songs, oldIndex, newIndex)
    setSongs(newSongs)

    setIsSaving(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: newSongs.map((s) => s.id) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? 'Failed to update order')
      }

      onReorder?.(newSongs)
    } catch (err) {
      // Rollback on error
      setSongs(songs)
      alert(err instanceof Error ? err.message : '更新失败')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      {isSaving && (
        <p className="mb-2 text-xs text-muted-foreground">保存中...</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {songs.map((song, index) => (
              <SortableSongRow key={song.id} song={song} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
```

- [ ] **Step 2: Update album detail page to use DraggableSongList**

Modify `apps/web/src/app/albums/[id]/page.tsx`:

Replace the static song list rendering with:

```tsx
import { DraggableSongList } from '../_components/DraggableSongList'

// In the render body, replace the songs.map block with:
{ songs.length > 0 ? (
  <DraggableSongList songs={songs} albumId={id} />
) : (
  <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
) }
```

- [ ] **Step 3: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/albums/_components/DraggableSongList.tsx apps/web/src/app/albums/\[id\]/page.tsx
git commit -m "feat(web): add DraggableSongList with @dnd-kit and wire into detail page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Create SongSelector and AlbumFormDialog Components

**Files:**
- Create: `apps/web/src/app/albums/_components/SongSelector.tsx`
- Create: `apps/web/src/app/albums/_components/AlbumFormDialog.tsx`

- [ ] **Step 1: Create SongSelector**

Create `apps/web/src/app/albums/_components/SongSelector.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { SongRow } from '@kiyo/ui'
import { Input } from '@kiyo/ui/src/components/ui/input'

interface Song {
  id: string
  title: string
}

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}

export function SongSelector({ selectedIds, onChange }: SongSelectorProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/songs')
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs ?? [])
        setLoading(false)
      })
  }, [])

  const filteredSongs = songs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  )

  function toggleSong(id: string, selected: boolean) {
    if (selected) {
      onChange([...selectedIds, id])
    } else {
      onChange(selectedIds.filter((sid) => sid !== id))
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-3">
      <Input
        placeholder="搜索歌曲..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.map((song) => (
          <SongRow
            key={song.id}
            id={song.id}
            title={song.title}
            mode="select"
            selected={selectedIds.includes(song.id)}
            onSelect={toggleSong}
          />
        ))}
        {filteredSongs.length === 0 && (
          <p className="text-sm text-muted-foreground">没有找到匹配的歌曲</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">已选择 {selectedIds.length} 首歌曲</p>
    </div>
  )
}
```

- [ ] **Step 2: Create AlbumFormDialog**

Create `apps/web/src/app/albums/_components/AlbumFormDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui/src/components/ui/dialog'
import { Button } from '@kiyo/ui'
import { Input } from '@kiyo/ui/src/components/ui/input'
import { Textarea } from '@kiyo/ui/src/components/ui/textarea'
import { SongSelector } from './SongSelector'
import { useRouter } from 'next/navigation'

interface AlbumFormDialogProps {
  mode: 'create' | 'edit'
  album?: {
    id: string
    title: string
    description: string | null
  }
  trigger: React.ReactNode
}

export function AlbumFormDialog({ mode, album, trigger }: AlbumFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(album?.title ?? '')
  const [description, setDescription] = useState(album?.description ?? '')
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const url = mode === 'create' ? '/api/albums' : `/api/albums/${album!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body: Record<string, any> = { title, description: description || null }
      if (selectedSongIds.length > 0) {
        body.song_ids = selectedSongIds
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? '操作失败')
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建专辑' : '编辑专辑'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">专辑名称</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入专辑名称"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">描述（可选）</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入专辑描述"
              rows={3}
            />
          </div>
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">选择歌曲</label>
              <SongSelector selectedIds={selectedSongIds} onChange={setSelectedSongIds} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? '保存中...' : mode === 'create' ? '创建' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

Note: `Dialog`, `Input`, `Textarea` components from shadcn may need to be installed first:
`cd packages/ui && npx shadcn add dialog input textarea`

- [ ] **Step 3: Wire AlbumFormDialog into album list page**

Modify `apps/web/src/app/albums/page.tsx`:

Add import:
```tsx
import { AlbumFormDialog } from './_components/AlbumFormDialog'
```

Replace the "新建专辑" button with:
```tsx
<AlbumFormDialog
  mode="create"
  trigger={
    <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
      新建专辑
    </button>
  }
/>
```

- [ ] **Step 4: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/albums/_components/ apps/web/src/app/albums/page.tsx
git commit -m "feat(web): add AlbumFormDialog and SongSelector components

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Create DeleteConfirmDialog and Wire It In

**Files:**
- Create: `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx`
- Modify: `apps/web/src/app/albums/page.tsx`

- [ ] **Step 1: Create DeleteConfirmDialog**

Create `apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui/src/components/ui/dialog'
import { Button } from '@kiyo/ui'
import { useRouter } from 'next/navigation'

interface DeleteConfirmDialogProps {
  albumId: string
  albumTitle: string
  trigger: React.ReactNode
}

export function DeleteConfirmDialog({ albumId, albumTitle, trigger }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? '删除失败')
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          确定要删除专辑 <strong>{albumTitle}</strong> 吗？此操作不可撤销，但不会影响专辑中的歌曲。
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '删除中...' : '删除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add delete button to album list page**

Modify `apps/web/src/app/albums/page.tsx` to wrap `AlbumCard` with a container that includes a delete button:

```tsx
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog'

// Inside the albums.map:
<div key={album.id} className="relative group">
  <Link href={`/albums/${album.id}`}>
    <AlbumCard
      title={album.title}
      description={album.description}
      songCount={songCounts[album.id] ?? 0}
      coverUrl={album.cover_url}
    />
  </Link>
  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
    <DeleteConfirmDialog
      albumId={album.id}
      albumTitle={album.title}
      trigger={
        <button className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90">
          <Trash2 className="h-4 w-4" />
        </button>
      }
    />
  </div>
</div>
```

Also add import: `import { Trash2 } from 'lucide-react'`

- [ ] **Step 3: Run type check**

Run: `cd /home/kk/Github/kiyo && pnpm type-check -- --filter=web`
Expected: Pass with no errors

- [ ] **Step 4: Run all API tests**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run`
Expected: All API route tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/albums/_components/DeleteConfirmDialog.tsx apps/web/src/app/albums/page.tsx
git commit -m "feat(web): add DeleteConfirmDialog and wire delete into album list

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Final Integration and Verification

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run full type check across workspace**

Run: `cd /home/kk/Github/kiyo && pnpm type-check`
Expected: All packages pass

- [ ] **Step 2: Run all tests**

Run: `cd /home/kk/Github/kiyo/apps/web && npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Run lint**

Run: `cd /home/kk/Github/kiyo && pnpm lint -- --filter=web`
Expected: No lint errors

- [ ] **Step 4: Verify build**

Run: `cd /home/kk/Github/kiyo && pnpm build -- --filter=web`
Expected: Build succeeds

- [ ] **Step 5: Final commit or create PR**

All changes are committed incrementally. At this point the feature branch is complete. Create a PR or merge according to project workflow.
