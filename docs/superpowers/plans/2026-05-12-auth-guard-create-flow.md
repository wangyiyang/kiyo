# Auth Guard Create Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent unauthenticated users from entering song, lyric, and album creation forms by adding auth guards at entry points, with login redirection and post-login return flow.

**Architecture:** Server-side layout guards for `/songs/new` and `/lyrics/new`, client-side `AuthGuardButton` for list-page "New" buttons, client-side auth check in `AlbumFormDialog` for create mode, and `redirectTo` support across all login methods.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, next-intl, Supabase SSR, Tailwind CSS, shadcn/ui, Vitest, Playwright

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/components/auth/auth-guard-button.tsx` | Create | Client-side button wrapper: checks session, redirects to login if unauthenticated |
| `apps/web/src/components/auth/auth-guard-button.test.tsx` | Create | Unit tests for AuthGuardButton |
| `apps/web/src/app/[locale]/songs/new/layout.tsx` | Create | Server layout: redirects unauthenticated users to login |
| `apps/web/src/app/[locale]/lyrics/new/layout.tsx` | Create | Server layout: redirects unauthenticated users to login |
| `apps/web/src/app/[locale]/songs/page.tsx` | Modify | Replace "New" `<Link>` with `<AuthGuardButton>` |
| `apps/web/src/app/[locale]/lyrics/page.tsx` | Modify | Replace "New" `<Link>` with `<AuthGuardButton>` |
| `apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx` | Modify | Add auth check before opening dialog in create mode |
| `apps/web/src/app/actions/auth.ts` | Modify | Add `next` parameter to `signInWithOAuth` and `sendMagicLink` |
| `apps/web/src/components/auth/oauth-buttons.tsx` | Modify | Read `redirectTo` from URL and pass to `signInWithOAuth` |
| `apps/web/src/components/auth/magic-link-form.tsx` | Modify | Read `redirectTo` from URL and pass to `sendMagicLink` |
| `apps/web/src/app/[locale]/login/page.tsx` | Modify | Pass `searchParams.redirectTo` to `AuthGuard` |
| `apps/web/src/app/[locale]/songs/new/page.tsx` | Modify | Map error codes to localized messages |
| `apps/web/src/app/[locale]/lyrics/new/page.tsx` | Modify | Map error codes to localized messages |
| `apps/web/messages/zh.json` | Modify | Add `common.errors.unauthorized` and `common.errors.validationError` |
| `apps/web/messages/en.json` | Modify | Add `common.errors.unauthorized` and `common.errors.validationError` |

---

### Task 1: AuthGuardButton Component

**Files:**
- Create: `apps/web/src/components/auth/auth-guard-button.tsx`
- Create: `apps/web/src/components/auth/auth-guard-button.test.tsx`
- Modify: `apps/web/src/components/auth/index.ts` (if exists, export new component)

- [ ] **Step 1: Create AuthGuardButton component**

```tsx
'use client'

import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { createBrowserClient } from '@kiyo/supabase/client'

interface AuthGuardButtonProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function AuthGuardButton({ href, children, className }: AuthGuardButtonProps) {
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/login?redirectTo=${encodeURIComponent(href)}`)
      return
    }
    router.push(href)
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
```

- [ ] **Step 2: Write unit tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthGuardButton } from './auth-guard-button'

vi.mock('@kiyo/supabase/client', () => ({
  createBrowserClient: vi.fn()
}))

vi.mock('@/i18n/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('AuthGuardButton', () => {
  it('navigates to href when authenticated', async () => {
    const { createBrowserClient } = await import('@kiyo/supabase/client')
    const { useRouter } = await import('@/i18n/navigation')
    const mockPush = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
      }
    } as any)

    render(
      <AuthGuardButton href="/songs/new" className="test-class">
        New Song
      </AuthGuardButton>
    )

    fireEvent.click(screen.getByText('New Song'))

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/songs/new')
    })
  })

  it('redirects to login with redirectTo when not authenticated', async () => {
    const { createBrowserClient } = await import('@kiyo/supabase/client')
    const { useRouter } = await import('@/i18n/navigation')
    const mockPush = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush } as any)
    vi.mocked(createBrowserClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
      }
    } as any)

    render(
      <AuthGuardButton href="/songs/new">
        New Song
      </AuthGuardButton>
    )

    fireEvent.click(screen.getByText('New Song'))

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirectTo=%2Fsongs%2Fnew')
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/components/auth/auth-guard-button.test.tsx`

Expected: 2 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/auth-guard-button.tsx apps/web/src/components/auth/auth-guard-button.test.tsx
git commit -m "feat(auth): add AuthGuardButton component for entry-point auth checks"
```

---

### Task 2: Songs/New Server Layout

**Files:**
- Create: `apps/web/src/app/[locale]/songs/new/layout.tsx`

- [ ] **Step 1: Create layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

export default async function NewSongLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/songs/new')
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Run dev server and manually verify**

Run: `pnpm --filter web dev`

In an incognito window, navigate to `http://localhost:3000/songs/new`.

Expected: Redirects to `/login?redirectTo=%2Fsongs%2Fnew`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/songs/new/layout.tsx
git commit -m "feat(auth): add server auth guard to songs/new layout"
```

---

### Task 3: Lyrics/New Server Layout

**Files:**
- Create: `apps/web/src/app/[locale]/lyrics/new/layout.tsx`

- [ ] **Step 1: Create layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

export default async function NewLyricLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/lyrics/new')
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Run dev server and manually verify**

In an incognito window, navigate to `http://localhost:3000/lyrics/new`.

Expected: Redirects to `/login?redirectTo=%2Flyrics%2Fnew`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/lyrics/new/layout.tsx
git commit -m "feat(auth): add server auth guard to lyrics/new layout"
```

---

### Task 4: List Page Button Guards

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/page.tsx`
- Modify: `apps/web/src/app/[locale]/lyrics/page.tsx`

- [ ] **Step 1: Modify songs/page.tsx**

Replace the "New Song" `<Link>` with `<AuthGuardButton>`. The original code:

```tsx
<Link
  href="/songs/new"
  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
>
  <Plus className="h-4 w-4" />
  {t('list.new')}
</Link>
```

Change to:

```tsx
import { AuthGuardButton } from '@/components/auth/auth-guard-button'

// ...

<AuthGuardButton
  href="/songs/new"
  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
>
  <Plus className="h-4 w-4" />
  {t('list.new')}
</AuthGuardButton>
```

- [ ] **Step 2: Modify lyrics/page.tsx**

Similarly replace the "New Lyric" `<Link>` with `<AuthGuardButton>`:

```tsx
import { AuthGuardButton } from '@/components/auth/auth-guard-button'

// ...

<AuthGuardButton
  href="/lyrics/new"
  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
>
  <Plus className="h-4 w-4" />
  {t('list.new')}
</AuthGuardButton>
```

- [ ] **Step 3: Run dev server and manually verify**

In an incognito window:
1. Go to `/songs`, click "New Song" — should redirect to login with `redirectTo=/songs/new`
2. Go to `/lyrics`, click "New Lyric" — should redirect to login with `redirectTo=/lyrics/new`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/[locale]/songs/page.tsx apps/web/src/app/[locale]/lyrics/page.tsx
git commit -m "feat(auth): guard create buttons on songs and lyrics list pages"
```

---

### Task 5: AlbumFormDialog Auth Check

**Files:**
- Modify: `apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx`

- [ ] **Step 1: Add auth check before opening dialog**

Add imports:

```tsx
import { createBrowserClient } from '@kiyo/supabase/client'
```

Replace the `Dialog` open handling. Current code:

```tsx
<Dialog open={open} onOpenChange={setOpen}>
```

Change to:

```tsx
const handleOpenChange = async (newOpen: boolean) => {
  if (newOpen && mode === 'create') {
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login?redirectTo=/albums')
      return
    }
  }
  setOpen(newOpen)
}

// ...

<Dialog open={open} onOpenChange={handleOpenChange}>
```

- [ ] **Step 2: Run dev server and manually verify**

In an incognito window, go to `/albums`, click "New Album" button.

Expected: Dialog does not open, page redirects to `/login?redirectTo=%2Falbums`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx
git commit -m "feat(auth): add auth check to album create dialog"
```

---

### Task 6: Auth Actions RedirectTo Support

**Files:**
- Modify: `apps/web/src/app/actions/auth.ts`
- Modify: `apps/web/src/components/auth/oauth-buttons.tsx`
- Modify: `apps/web/src/components/auth/magic-link-form.tsx`

- [ ] **Step 1: Modify signInWithOAuth in auth.ts**

Change function signature and redirectTo construction:

```ts
export async function signInWithOAuth(
  provider: 'github' | 'google',
  next?: string
): Promise<never> {
  const supabase = await createServerClient()
  const baseRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  const redirectTo = next
    ? `${baseRedirectTo}?next=${encodeURIComponent(next)}`
    : baseRedirectTo

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  })

  if (error || !data.url) {
    throw new Error(error?.message ?? 'OAuth failed')
  }

  redirect(data.url)
}
```

- [ ] **Step 2: Modify sendMagicLink in auth.ts**

Change function signature and emailRedirectTo construction:

```ts
export async function sendMagicLink(
  email: string,
  next?: string
): Promise<AuthResult> {
  const supabase = await createServerClient()
  const baseRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`
  const emailRedirectTo = next
    ? `${baseRedirectTo}?next=${encodeURIComponent(next)}`
    : baseRedirectTo

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  })

  if (error) {
    return {
      ok: false,
      message: error.message,
      code: error.code ?? 'UNKNOWN',
    }
  }

  return { ok: true, message: 'Login link sent! Check your email.' }
}
```

- [ ] **Step 3: Modify OAuthButtons to pass redirectTo**

```tsx
'use client'

import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { signInWithOAuth } from '@/app/actions/auth'
import { Button } from '@kiyo/ui'
import { Github, Chrome } from 'lucide-react'

export function OAuthButtons() {
  const t = useTranslations('auth')
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? undefined

  const handleGitHubSignIn = () => {
    signInWithOAuth('github', redirectTo)
  }

  const handleGoogleSignIn = () => {
    signInWithOAuth('google', redirectTo)
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignIn}
      >
        <Github className="mr-2 h-4 w-4" />
        {t('oauth.github')}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignIn}
      >
        <Chrome className="mr-2 h-4 w-4" />
        {t('oauth.google')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: Modify MagicLinkForm to pass redirectTo**

Add `useSearchParams` import and read `redirectTo`:

```tsx
import { useSearchParams } from 'next/navigation'

// Inside component:
const searchParams = useSearchParams()
const redirectTo = searchParams.get('redirectTo') ?? undefined

// In onSubmit:
const result = await sendMagicLink(values.email, redirectTo)
```

- [ ] **Step 5: Run tests for auth actions**

Run: `cd apps/web && npx vitest run src/app/actions/auth.test.ts` (if exists) or verify through existing tests.

Also run TypeScript check: `cd apps/web && pnpm type-check`

Expected: No type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/actions/auth.ts apps/web/src/components/auth/oauth-buttons.tsx apps/web/src/components/auth/magic-link-form.tsx
git commit -m "feat(auth): support redirectTo in OAuth and Magic Link login flows"
```

---

### Task 7: Login Page RedirectTo

**Files:**
- Modify: `apps/web/src/app/[locale]/login/page.tsx`

- [ ] **Step 1: Modify login page to read searchParams**

```tsx
import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kiyo/ui'

import { LoginForm } from '@/components/auth/login-form'
import { AuthGuard } from '@/components/auth/auth-guard'
import { SiteHeader } from '@/components/site-header'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth')
  return {
    title: t('login.title'),
  }
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string }
}) {
  return (
    <>
      <SiteHeader />
      <AuthGuard redirectTo={searchParams.redirectTo ?? '/'}>
        <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl">Log in to Kiyo</CardTitle>
              <CardDescription>Welcome back</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    </>
  )
}
```

- [ ] **Step 2: Run dev server and verify**

In a logged-in browser, visit `/login?redirectTo=/songs/new`.

Expected: Redirects to `/songs/new` (not `/`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/[locale]/login/page.tsx
git commit -m "feat(auth): pass redirectTo to AuthGuard on login page"
```

---

### Task 8: Error Message Localization

**Files:**
- Modify: `apps/web/src/app/[locale]/songs/new/page.tsx`
- Modify: `apps/web/src/app/[locale]/lyrics/new/page.tsx`
- Modify: `apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx`

- [ ] **Step 1: Modify songs/new/page.tsx error handling**

In the `handleSave` function, replace the error display logic:

```tsx
// Replace this line:
// setError(data.error?.message || tCommon('errors.createFailed'))

// With:
const errorMap: Record<string, string> = {
  UNAUTHORIZED: tCommon('errors.unauthorized'),
  VALIDATION_ERROR: tCommon('errors.validationError'),
}
setError(errorMap[data.error?.code] || tCommon('errors.createFailed'))
```

- [ ] **Step 2: Modify lyrics/new/page.tsx error handling**

Same change as songs/new:

```tsx
const errorMap: Record<string, string> = {
  UNAUTHORIZED: tCommon('errors.unauthorized'),
  VALIDATION_ERROR: tCommon('errors.validationError'),
}
setError(errorMap[data.error?.code] || tCommon('errors.createFailed'))
```

- [ ] **Step 3: Modify AlbumFormDialog error handling**

Replace the `alert()` error display. Current code in `handleSubmit`:

```tsx
alert(err instanceof Error ? err.message : tCommon('errors.unknown'))
```

Add state for error display:

```tsx
const [error, setError] = useState('')
```

In `handleSubmit`, replace the catch block:

```tsx
} catch (err) {
  if (err instanceof Error) {
    // Try to map known error codes
    const code = (err as any).code as string | undefined
    if (code === 'UNAUTHORIZED') {
      setError(tCommon('errors.unauthorized'))
    } else if (code === 'VALIDATION_ERROR') {
      setError(tCommon('errors.validationError'))
    } else {
      setError(err.message || tCommon('errors.unknown'))
    }
  } else {
    setError(tCommon('errors.unknown'))
  }
}
```

Add error display in the form (before the buttons):

```tsx
{error && <p className="text-sm text-destructive">{error}</p>}
```

Also clear error on dialog close:

```tsx
const handleOpenChange = async (newOpen: boolean) => {
  if (!newOpen) setError('')
  // ... rest of auth check
}
```

- [ ] **Step 4: Run type check**

Run: `cd apps/web && pnpm type-check`

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/[locale]/songs/new/page.tsx apps/web/src/app/[locale]/lyrics/new/page.tsx apps/web/src/app/[locale]/albums/_components/AlbumFormDialog.tsx
git commit -m "feat(i18n): localize error messages for create forms"
```

---

### Task 9: Translation Keys

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add to zh.json**

In the `common.errors` object, add:

```json
"unauthorized": "请先登录后再进行操作",
"validationError": "请检查输入内容是否正确"
```

Be careful to avoid the git merge conflict area near `nav.dashboard`/`nav.settings`.

- [ ] **Step 2: Add to en.json**

In the `common.errors` object, add:

```json
"unauthorized": "Please log in first to continue",
"validationError": "Please check your input"
```

- [ ] **Step 3: Verify JSON is valid**

Run: `cd apps/web && node -e "JSON.parse(require('fs').readFileSync('./messages/zh.json'))" && echo "zh.json valid"`
Run: `cd apps/web && node -e "JSON.parse(require('fs').readFileSync('./messages/en.json'))" && echo "en.json valid"`

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add unauthorized and validation error translations"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/web && pnpm test`

Expected: All existing tests pass, new AuthGuardButton tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `cd apps/web && pnpm type-check`

Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `cd apps/web && pnpm lint`

Expected: No lint errors.

- [ ] **Step 4: Manual end-to-end verification**

Start dev server: `pnpm --filter web dev`

Test checklist (in incognito window):
1. Visit `/songs/new` → redirects to `/login?redirectTo=%2Fsongs%2Fnew`
2. Visit `/lyrics/new` → redirects to `/login?redirectTo=%2Flyrics%2Fnew`
3. Visit `/songs`, click "New Song" → redirects to login with redirectTo
4. Visit `/lyrics`, click "New Lyric" → redirects to login with redirectTo
5. Visit `/albums`, click "New Album" → redirects to login with redirectTo
6. Log in via password, OAuth, or Magic Link → returns to original intent page
7. Log in and visit create pages → pages load normally

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "chore: verify auth guard create flow (issue #135)"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Server layout guard for `/songs/new` | Task 2 ✅ |
| Server layout guard for `/lyrics/new` | Task 3 ✅ |
| Client button guard for list pages | Task 1 + Task 4 ✅ |
| Auth check for album create dialog | Task 5 ✅ |
| Login redirectTo support (password) | Already exists ✅ |
| Login redirectTo support (OAuth) | Task 6 ✅ |
| Login redirectTo support (Magic Link) | Task 6 ✅ |
| Login page passes redirectTo to AuthGuard | Task 7 ✅ |
| Error message localization | Task 8 ✅ |
| Translation keys | Task 9 ✅ |

### Placeholder Scan

No TBD, TODO, or vague requirements found. All steps contain actual code.

### Type Consistency

- `redirectTo` is consistently `string | undefined` across all functions
- `next` parameter in `signInWithOAuth` and `sendMagicLink` is `string | undefined`
- Error code keys (`UNAUTHORIZED`, `VALIDATION_ERROR`) match API response codes
