# Mobile Navigation Hamburger Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile hamburger menu that slides in from the right on `< md` viewports, containing nav links, locale switcher, and theme toggle; also migrate SiteHeader nav labels to `next-intl`.

**Architecture:** Create a self-contained `MobileNavSheet` client component that wraps shadcn Sheet primitives, keeps its own open/close state, and auto-closes on breakpoint crossover via `matchMedia`. SiteHeader delegates mobile nav entirely to this component and switches desktop nav labels from hardcoded Chinese to `useTranslations('nav')`.

**Tech Stack:** React 18, Next.js 14, TypeScript, Tailwind CSS, shadcn/ui (Radix Dialog), next-intl, vitest, @testing-library/react

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/ui/src/components/ui/sheet.tsx` | Create | shadcn Sheet primitive (Radix Dialog wrapper with side variants) |
| `packages/ui/index.ts` | Modify | Export Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription, SheetClose, SheetPortal, SheetOverlay |
| `apps/web/messages/zh.json` | Modify | Add `nav` namespace with menu, openMenu, songs, albums, lyrics, language, theme |
| `apps/web/messages/en.json` | Modify | Add `nav` namespace with English equivalents |
| `apps/web/src/components/mobile-nav-sheet.tsx` | Create | Mobile hamburger trigger + right-side Sheet drawer with nav links, locale switcher, theme toggle |
| `apps/web/src/components/mobile-nav-sheet.test.tsx` | Create | Component tests: render, open, close on link click, close on ESC, aria-label, matchMedia breakpoint close |
| `apps/web/src/components/site-header.tsx` | Modify | Remove `label` from navLinks, use `t(link.key)` in desktop nav, insert `<MobileNavSheet />` in right actions area |
| `apps/web/tests/e2e/mobile-nav.spec.ts` | Create | Playwright E2E: mobile viewport drawer open → click link → navigate + close |

---

### Task 1: Install component-testing dependencies

**Context:** The project has vitest + jsdom but lacks `@testing-library/react` and `@testing-library/jest-dom`, which are required for the component tests specified in the acceptance criteria.

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install dev dependencies**

```bash
cd apps/web
pnpm add -D @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Verify installation**

```bash
cd apps/web
pnpm list @testing-library/react @testing-library/jest-dom
```

Expected: Both packages appear in the devDependency tree.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
# also add any workspace lock changes
git commit -m "chore: add @testing-library/react and jest-dom for component tests"
```

---

### Task 2: Create shadcn Sheet primitive in packages/ui

**Files:**
- Create: `packages/ui/src/components/ui/sheet.tsx`

- [ ] **Step 1: Write sheet.tsx**

Create `packages/ui/src/components/ui/sheet.tsx` with the exact content below. It follows the same patterns as the existing `dialog.tsx` (same project, same styling conventions).

```tsx
"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "../../lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd packages/ui && pnpm type-check
```

Expected: `tsc --noEmit` exits with code 0.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ui/sheet.tsx
git commit -m "feat(ui): add shadcn Sheet primitive"
```

---

### Task 3: Export Sheet components from packages/ui

**Files:**
- Modify: `packages/ui/index.ts`

- [ ] **Step 1: Add Sheet exports**

Add the following block to `packages/ui/index.ts` immediately after the `Dialog` export block (keep alphabetical-ish grouping by primitive):

```ts
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './src/components/ui/sheet'
```

The full file context around the insertion point currently looks like:

```ts
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './src/components/ui/dialog'
```

Insert the Sheet block right after that closing `}` and before the `Form` block.

- [ ] **Step 2: Verify types compile**

```bash
cd packages/ui && pnpm type-check
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/index.ts
git commit -m "feat(ui): export Sheet components"
```

---

### Task 4: Add nav i18n translation keys

**Files:**
- Modify: `apps/web/messages/zh.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Add nav namespace to zh.json**

In `apps/web/messages/zh.json`, add this top-level key right after the opening `{` (before `"metadata"`):

```json
  "nav": {
    "menu": "菜单",
    "openMenu": "打开导航菜单",
    "songs": "歌曲库",
    "albums": "专辑",
    "lyrics": "歌词",
    "language": "语言",
    "theme": "主题"
  },
```

Make sure there is a trailing comma after the closing `}` so the next key (`"metadata"`) is valid JSON.

- [ ] **Step 2: Add nav namespace to en.json**

In `apps/web/messages/en.json`, add the exact same structure with English values:

```json
  "nav": {
    "menu": "Menu",
    "openMenu": "Open navigation menu",
    "songs": "Songs",
    "albums": "Albums",
    "lyrics": "Lyrics",
    "language": "Language",
    "theme": "Theme"
  },
```

Again, ensure valid JSON comma placement.

- [ ] **Step 3: Commit**

```bash
git add apps/web/messages/zh.json apps/web/messages/en.json
git commit -m "feat(i18n): add nav translation keys"
```

---

### Task 5: Build MobileNavSheet component (TDD)

**Files:**
- Create: `apps/web/src/components/mobile-nav-sheet.tsx`
- Create: `apps/web/src/components/mobile-nav-sheet.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/src/components/mobile-nav-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { MobileNavSheet } from './mobile-nav-sheet'

const mockT = (key: string) => {
  const map: Record<string, string> = {
    openMenu: 'Open navigation menu',
    menu: 'Menu',
    songs: 'Songs',
    albums: 'Albums',
    lyrics: 'Lyrics',
    language: 'Language',
    theme: 'Theme',
  }
  return map[key] ?? key
}

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('./LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher">LocaleSwitcher</div>,
}))

vi.mock('./theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}))

describe('MobileNavSheet', () => {
  beforeEach(() => {
    // Reset matchMedia mock to default (mobile width, not matching md)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders trigger button with correct aria-label', () => {
    render(<MobileNavSheet />)
    expect(
      screen.getByRole('button', { name: /Open navigation menu/i })
    ).toBeInTheDocument()
  })

  it('opens sheet when trigger is clicked', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Songs/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Albums/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lyrics/i })).toBeInTheDocument()
  })

  it('closes sheet when a nav link is clicked', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('link', { name: /Songs/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes sheet on ESC key', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes sheet when matchMedia crosses md breakpoint', async () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (
          _event: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          changeHandler = handler
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    // Simulate crossing into md breakpoint
    changeHandler?.({ matches: true } as MediaQueryListEvent)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web
pnpm test -- src/components/mobile-nav-sheet.test.tsx
```

Expected: FAIL — "MobileNavSheet" is not defined / module not found.

- [ ] **Step 3: Implement MobileNavSheet component**

Create `apps/web/src/components/mobile-nav-sheet.tsx`:

```tsx
'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Separator,
} from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'

const navLinks = [
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const

export function MobileNavSheet() {
  const t = useTranslations('nav')
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('openMenu')}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:w-80">
        {/* Visually hidden title satisfies Radix Dialog a11y requirement */}
        <SheetTitle>
          <span className="sr-only">{t('menu')}</span>
        </SheetTitle>

        <nav className="mt-8 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-base text-foreground transition-colors hover:bg-accent"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <Separator className="my-6" />

        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('language')}
            </span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('theme')}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

> **Design notes:**
> - `useTranslations('nav')` pulls from the `nav` namespace added in Task 4.
> - `SheetTitle` wraps an `sr-only` span instead of `@radix-ui/react-visually-hidden` (not installed; avoids a new dependency).
> - `matchMedia` listener auto-closes the Sheet when the viewport crosses into `md` (≥768px), preventing a ghost modal when the hamburger trigger disappears.
> - `LocaleSwitcher` triggers a full-page navigation so the Sheet unmounts naturally; `ThemeToggle` intentionally does **not** close the Sheet so the user can see the theme change instantly.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web
pnpm test -- src/components/mobile-nav-sheet.test.tsx
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/mobile-nav-sheet.tsx \
        apps/web/src/components/mobile-nav-sheet.test.tsx
git commit -m "feat: add MobileNavSheet component with tests"
```

---

### Task 6: Refactor SiteHeader to use i18n and include MobileNavSheet

**Files:**
- Modify: `apps/web/src/components/site-header.tsx`

- [ ] **Step 1: Apply the refactor**

Make **three** changes to `apps/web/src/components/site-header.tsx`:

**Change A — add imports at the top:**

Add these two imports below the existing imports (after `import { createBrowserClient } from '@kiyo/supabase'`):

```ts
import { useTranslations } from 'next-intl'
import { MobileNavSheet } from './mobile-nav-sheet'
```

**Change B — update navLinks and add t() call:**

Replace the existing `navLinks` array:

```ts
const navLinks = [
  { href: '/songs', key: 'songs', label: '歌曲库' },
  { href: '/albums', key: 'albums', label: '专辑' },
  { href: '/lyrics', key: 'lyrics', label: '歌词' },
] as const
```

With:

```ts
const navLinks = [
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const
```

Then, inside the `SiteHeader` function body, add this line immediately after `const [user, setUser] = React.useState<{ email: string } | null>(null)`:

```ts
  const t = useTranslations('nav')
```

**Change C — swap label for t() in desktop nav and add MobileNavSheet:**

In the desktop `<nav>` block, replace `{link.label}` with `{t(link.key)}`:

```tsx
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
```

In the right actions `<div>`, append `<MobileNavSheet />` after `<UserMenu user={user} />`:

```tsx
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu user={user} />
          <MobileNavSheet />
        </div>
```

- [ ] **Step 2: Run type-check**

```bash
cd apps/web && pnpm type-check
```

Expected: `tsc --noEmit` exits with code 0.

- [ ] **Step 3: Run lint**

```bash
cd apps/web && pnpm lint
```

Expected: No new lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/site-header.tsx
git commit -m "feat(header): i18n nav labels and add MobileNavSheet"
```

---

### Task 7: Add Playwright E2E test

**Files:**
- Create: `apps/web/tests/e2e/mobile-nav.spec.ts`

- [ ] **Step 1: Verify Playwright is available**

```bash
cd apps/web
npx playwright --version
```

If the command fails with "command not found", install it:

```bash
cd apps/web
pnpm add -D @playwright/test
npx playwright install chromium
```

> If Playwright was not previously in the project, commit the dependency change separately before the test file.

- [ ] **Step 2: Write E2E spec**

Create `apps/web/tests/e2e/mobile-nav.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mobile nav drawer flow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')

  await page
    .getByRole('button', { name: /打开导航菜单|Open navigation menu/ })
    .click()

  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('link', { name: /歌曲库|Songs/ }).click()

  await expect(page).toHaveURL(/\/songs/)
  await expect(page.getByRole('dialog')).toBeHidden()
})
```

- [ ] **Step 3: Run the E2E test**

```bash
cd apps/web
npx playwright test tests/e2e/mobile-nav.spec.ts
```

Expected: Test passes (requires dev server or built app; use `pnpm dev` in another terminal if needed, or run against a preview build).

> **Note:** If the project does not yet have a Playwright config, you may need to run `npx playwright install` and create `playwright.config.ts`. Only do this if the test command fails due to missing config.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/e2e/mobile-nav.spec.ts
git commit -m "test(e2e): mobile nav drawer flow"
```

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task |
|---|---|
| Sheet primitive in packages/ui | Task 2 |
| Sheet exports in packages/ui/index.ts | Task 3 |
| MobileNavSheet component with nav links + LocaleSwitcher + ThemeToggle | Task 5 |
| `matchMedia` breakpoint auto-close | Task 5 (Step 3 implementation + test) |
| `md:hidden` on hamburger trigger | Task 5 (Step 3, `className="md:hidden"`) |
| SiteHeader uses `useTranslations('nav')` | Task 6 |
| `nav` i18n keys in zh.json + en.json | Task 4 |
| Component unit tests (open, close, ESC, aria-label, breakpoint) | Task 5 |
| E2E test (mobile viewport → open → click → navigate → close) | Task 7 |
| Click nav link closes Sheet | Task 5 (test + implementation) |
| ESC closes Sheet | Task 5 (test + Radix Dialog default) |
| Overlay click / close button closes Sheet | Handled by Radix Dialog defaults in SheetContent |
| Body scroll lock + focus trap | Handled by Radix Dialog in Sheet primitive |
| Focus returns to trigger on close | Handled by Radix Dialog |

**Gap:** None. All acceptance criteria map to a task.

### 2. Placeholder scan

- No "TBD", "TODO", "implement later" found.
- No vague "add error handling" or "handle edge cases" steps.
- Every test step contains exact test code.
- Every implementation step contains exact component code.
- No "Similar to Task N" references.

### 3. Type consistency

- `navLinks` array: removed `label` field, kept `key` field. Used as `{ href: string; key: string }` in both SiteHeader and MobileNavSheet.
- `useTranslations('nav')` used consistently across SiteHeader and MobileNavSheet.
- Translation keys: `menu`, `openMenu`, `songs`, `albums`, `lyrics`, `language`, `theme` — identical in zh.json, en.json, and component code.
- `SheetContent` side prop: `side="right"` matches the `right` variant in `sheetVariants`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-08-mobile-nav.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
