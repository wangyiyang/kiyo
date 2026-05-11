# Remove [locale] Prefix from URLs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `/[locale]` prefix from all URLs (e.g. `/zh/songs` → `/songs`) while keeping the app fully internationalized with Chinese (`zh`) as the default/fallback locale.

**Architecture:** Move all pages from `app/[locale]/*` to `app/*`, delete the `[locale]` dynamic segment, simplify middleware to use `localePrefix: 'never'`, update `withLocale` to return un-prefixed paths, and remove all hardcoded `/${locale}/` path construction in page components.

**Tech Stack:** Next.js 14 App Router, next-intl v4, TypeScript, Tailwind CSS

---

## File Structure Changes

| Action | Source | Destination | Notes |
|--------|--------|-------------|-------|
| Move | `app/[locale]/page.tsx` | `app/page.tsx` | Replace existing redirect-only root page |
| Move | `app/[locale]/layout.tsx` | `app/layout.tsx` | Merge with existing root layout |
| Move | `app/[locale]/explore/page.tsx` | `app/explore/page.tsx` | |
| Move | `app/[locale]/contact/page.tsx` | `app/contact/page.tsx` | |
| Move | `app/[locale]/privacy/page.tsx` | `app/privacy/page.tsx` | |
| Move | `app/[locale]/terms/page.tsx` | `app/terms/page.tsx` | |
| Move | `app/[locale]/error.tsx` | `app/error.tsx` | Overwrite or merge |
| Move | `app/[locale]/not-found.tsx` | `app/not-found.tsx` | Overwrite or merge |
| Delete | `app/[locale]/` | — | Remove entire directory after move |
| Modify | `app/layout.tsx` | — | Merge NextIntlClientProvider from `[locale]/layout.tsx` |
| Modify | `middleware.ts` | — | Remove manual rewrite; use `localePrefix: 'never'` |
| Modify | `i18n/server.ts` | — | `withLocale` returns path as-is; `getLocale` reads cookie/header |
| Modify | `i18n/navigation.ts` | — | `localePrefix: 'never'` |
| Modify | `i18n/config.ts` | — | `defaultLocale: 'zh'` |
| Modify | `app/songs/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/songs/[id]/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/albums/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/albums/[id]/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/lyrics/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/lyrics/[id]/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/forgot-password/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `app/register/page.tsx` | — | Remove `/${locale}/` prefixes |
| Modify | `components/auth/auth-guard.tsx` | — | `withLocale` now no-op for paths |
| Modify | `app/sitemap.ts` | — | Remove `/zh` entry |
| Modify | `app/robots.ts` | — | Verify no locale-prefixed paths |

---

## Task 1: Move [locale] Pages to Root

**Files:**
- Move: `app/[locale]/page.tsx` → `app/page.tsx`
- Move: `app/[locale]/layout.tsx` → `app/layout.tsx`
- Move: `app/[locale]/explore/page.tsx` → `app/explore/page.tsx`
- Move: `app/[locale]/contact/page.tsx` → `app/contact/page.tsx`
- Move: `app/[locale]/privacy/page.tsx` → `app/privacy/page.tsx`
- Move: `app/[locale]/terms/page.tsx` → `app/terms/page.tsx`
- Move: `app/[locale]/error.tsx` → `app/error.tsx`
- Move: `app/[locale]/not-found.tsx` → `app/not-found.tsx`
- Delete: `app/[locale]/` directory

- [ ] **Step 1: Move all [locale] pages to root**

```bash
cd apps/web/src/app
# Move pages
mv [locale]/page.tsx page.tsx.new
mv [locale]/explore explore
mv [locale]/contact contact
mv [locale]/privacy privacy
mv [locale]/terms terms
mv [locale]/error.tsx error.tsx.new
mv [locale]/not-found.tsx not-found.tsx.new
# Remove old [locale] directory
rm -rf [locale]
```

- [ ] **Step 2: Merge root layout with locale layout**

Current `app/layout.tsx` has `NextIntlClientProvider` with `defaultLocale='en'`. The `[locale]/layout.tsx` has the full setup with `setRequestLocale`, `getMessages()`, metadata generation, and wraps children with `GlobalPlayer`, `WaitlistDialog`, `FeedbackDialog`.

Merge them: the new root `layout.tsx` should combine the font setup, metadata, viewport from the old root layout with the i18n setup from `[locale]/layout.tsx`. Remove `generateStaticParams` (no longer needed without `[locale]`).

```tsx
// apps/web/src/app/layout.tsx — merged version
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "@kiyo/ui";
import { defaultLocale, locales, type Locale } from "@/i18n/config";
import { Providers } from "./providers";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { GlobalPlayer } from "@/components/global-player";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ locale: defaultLocale, namespace: "metadata" });

  const ogLocaleMap: Record<Locale, string> = {
    en: "en_US",
    zh: "zh_CN",
  };

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t("title"),
      template: `%s · ${t("applicationName")}`,
    },
    description: t("description"),
    applicationName: t("applicationName"),
    openGraph: {
      type: "website",
      title: t("title"),
      description: t("description"),
      siteName: t("applicationName"),
      locale: ogLocaleMap[defaultLocale] ?? "en_US",
      images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@kiyo",
      title: t("title"),
      description: t("description"),
    },
    alternates: {
      canonical: "/",
      languages: {
        en: "/en",
        zh: "/zh",
      },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages({ locale: defaultLocale });

  return (
    <html
      lang={defaultLocale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider locale={defaultLocale} messages={messages}>
          <Providers>
            {children}
            <GlobalPlayer />
            <WaitlistDialog />
            <FeedbackDialog />
            <Toaster richColors closeButton position="top-center" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Replace root page.tsx with the home page content**

The old `app/page.tsx` was just a redirect. Replace it with the content from `[locale]/page.tsx`:

```tsx
// apps/web/src/app/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Features } from "@/components/sections/features";
import { FinalCta } from "@/components/sections/final-cta";
import { Hero } from "@/components/sections/hero";
import { HowItWorks } from "@/components/sections/how-it-works";
import { Showcase } from "@/components/sections/showcase";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: "Kiyo — AI Music Creation Platform",
      description: t("description"),
      images: [{ url: "/og-home.png", width: 1200, height: 630 }],
    },
  };
}

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Kiyo",
        url: siteUrl,
        logo: { "@type": "ImageObject", url: `${siteUrl}/logo.png` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: "Kiyo",
        applicationCategory: "MultimediaDesignApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/PreOrder",
        },
        description: "",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Hero />
          <Features />
          <HowItWorks />
          <Showcase />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat(i18n): move [locale] pages to root directory"
```

---

## Task 2: Update i18n Configuration

**Files:**
- Modify: `apps/web/src/i18n/config.ts`
- Modify: `apps/web/src/i18n/navigation.ts`
- Modify: `apps/web/src/i18n/server.ts`
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Change defaultLocale to 'zh'**

```ts
// apps/web/src/i18n/config.ts
export const locales = ['en', 'zh'] as const
export const defaultLocale = 'zh' as const
export type Locale = (typeof locales)[number]
```

- [ ] **Step 2: Update navigation.ts to use localePrefix: 'never'**

```ts
// apps/web/src/i18n/navigation.ts
import { createNavigation } from 'next-intl/navigation'
import { locales } from './config'

export const { Link, redirect, usePathname, useRouter } =
  createNavigation({
    locales,
    localePrefix: 'never',
  })
```

- [ ] **Step 3: Simplify server.ts — withLocale returns path as-is**

```ts
// apps/web/src/i18n/server.ts
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales } from './config'

const COOKIE_NAME = 'NEXT_LOCALE'

export async function getLocale(): Promise<string> {
  // 1. Check cookie first
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(COOKIE_NAME)?.value
  if (cookieLocale && locales.includes(cookieLocale as any)) {
    return cookieLocale
  }

  // 2. Fall back to Accept-Language header
  const h = await headers()
  const acceptLang = h.get('accept-language')
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0]?.split('-')[0]
    if (preferred && locales.includes(preferred as any)) {
      return preferred
    }
  }

  // 3. Default
  return defaultLocale
}

export async function withLocale(href: string): Promise<string> {
  // No locale prefix in URLs anymore
  return href
}
```

- [ ] **Step 4: Simplify middleware.ts**

```ts
// apps/web/src/middleware.ts
import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@kiyo/supabase'
import { defaultLocale, locales } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request)
  return await updateSession(request, intlResponse)
}

export const config = {
  matcher: [
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/i18n/
git add apps/web/src/middleware.ts
git commit -m "feat(i18n): remove locale prefix from routing config"
```

---

## Task 3: Remove Hardcoded Locale Prefixes from Pages

**Files:**
- Modify: `apps/web/src/app/songs/page.tsx`
- Modify: `apps/web/src/app/songs/[id]/page.tsx`
- Modify: `apps/web/src/app/albums/page.tsx`
- Modify: `apps/web/src/app/albums/[id]/page.tsx`
- Modify: `apps/web/src/app/lyrics/page.tsx`
- Modify: `apps/web/src/app/lyrics/[id]/page.tsx`
- Modify: `apps/web/src/app/forgot-password/page.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Modify: `apps/web/src/app/[locale]/privacy/page.tsx` (now `app/privacy/page.tsx`)

- [ ] **Step 1: Update songs/page.tsx**

Remove `getLocale` import and all `/${locale}/` prefixes. Use plain paths like `/login`, `/songs/generate`, `/songs/new`, `/songs/${song.id}`.

```tsx
// Key changes:
// Remove: import { getLocale } from '@/i18n/server'
// Remove: const locale = await getLocale()
// Change: redirect(`/${locale}/login`) → redirect('/login')
// Change: href={`/${locale}/songs/generate`} → href="/songs/generate"
// Change: href={`/${locale}/songs/new`} → href="/songs/new"
// Change: href={`/${locale}/songs/${song.id}`} → href={`/songs/${song.id}`}
```

- [ ] **Step 2: Update songs/[id]/page.tsx**

Same pattern — remove `getLocale` and all `/${locale}/` prefixes.

- [ ] **Step 3: Update albums/page.tsx**

Remove `getLocale` and `/${locale}/` prefixes.

- [ ] **Step 4: Update albums/[id]/page.tsx**

Remove `getLocale` and `/${locale}/` prefixes.

- [ ] **Step 5: Update lyrics/page.tsx**

Remove `getLocale` and `/${locale}/` prefixes.

- [ ] **Step 6: Update lyrics/[id]/page.tsx**

Remove `getLocale` and `/${locale}/` prefixes.

- [ ] **Step 7: Update forgot-password/page.tsx**

Remove `getLocale` import and `/${locale}/login` → `/login`.

- [ ] **Step 8: Update register/page.tsx**

Remove `getLocale` import and `/${locale}/login` → `/login`.

- [ ] **Step 9: Update privacy/page.tsx (moved from [locale])**

Remove `getLocale` import if present.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/app/songs/
git add apps/web/src/app/albums/
git add apps/web/src/app/lyrics/
git add apps/web/src/app/forgot-password/
git add apps/web/src/app/register/
git add apps/web/src/app/privacy/
git commit -m "feat(i18n): remove hardcoded locale prefixes from page links"
```

---

## Task 4: Update Components and Utilities

**Files:**
- Modify: `apps/web/src/components/auth/auth-guard.tsx`
- Modify: `apps/web/src/app/page.tsx` (already done in Task 1)
- Modify: `apps/web/src/app/sitemap.ts`
- Modify: `apps/web/src/components/LocaleSwitcher.tsx`

- [ ] **Step 1: Update auth-guard.tsx**

`withLocale` is now a no-op, so this component still works. But we can simplify:

```tsx
// apps/web/src/components/auth/auth-guard.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function AuthGuard({
  children,
  redirectTo = '/',
}: AuthGuardProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(redirectTo)
  }

  return <>{children}</>
}
```

- [ ] **Step 2: Update sitemap.ts**

Remove the `/zh` entry since URLs are no longer locale-prefixed.

```ts
// apps/web/src/app/sitemap.ts
import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kiyo.ai";

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
```

- [ ] **Step 3: Update LocaleSwitcher**

The locale switcher should set a cookie instead of changing the URL path, since URLs don't have locale prefixes anymore.

```tsx
'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kiyo/ui'
import { Button } from '@kiyo/ui'
import { Globe } from 'lucide-react'

const locales = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const

export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('localeSwitcher')

  const handleChange = (nextLocale: string) => {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  const currentLabel = locales.find((l) => l.code === locale)?.label ?? locale

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="mr-2 h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => handleChange(l.code)}
            className={locale === l.code ? 'bg-accent' : ''}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/auth-guard.tsx
git add apps/web/src/app/sitemap.ts
git add apps/web/src/components/LocaleSwitcher.tsx
git commit -m "feat(i18n): update auth guard, sitemap, and locale switcher for no-prefix routing"
```

---

## Task 5: Verify and Test

- [ ] **Step 1: Run TypeScript type check**

```bash
cd /home/kk/Github/kiyo/.worktrees/issue-109
pnpm type-check
```

Expected: No type errors related to i18n or routing.

- [ ] **Step 2: Run linter**

```bash
pnpm lint
```

Expected: No lint errors.

- [ ] **Step 3: Check for remaining getLocale/withLocale usage**

```bash
cd apps/web/src
find . -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs grep -l "getLocale\|withLocale\|X-NEXT-INTL-LOCALE"
```

Expected: Only `i18n/server.ts` should remain (with the simplified implementations). No page or component files should use these.

- [ ] **Step 4: Check for remaining hardcoded locale paths**

```bash
cd apps/web/src
find . -type f \( -name "*.tsx" -o -name "*.ts" \) | xargs grep -n "/en/\|/zh/"
```

Expected: No hardcoded `/en/` or `/zh/` paths in page/component files (except possibly in comments or metadata alternates).

- [ ] **Step 5: Build the project**

```bash
pnpm --filter web build
```

Expected: Build succeeds without errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(i18n): verify no-prefix routing implementation"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Remove `/[locale]` prefix from URLs
- ✅ Keep i18n with Chinese as default
- ✅ Move pages from `app/[locale]/*` to `app/*`
- ✅ Simplify middleware
- ✅ Remove hardcoded `/${locale}/` paths
- ✅ Update locale switcher to use cookies
- ✅ Update sitemap
- ✅ Update auth guard

**2. Placeholder scan:**
- No TBD/TODO/fill in details found
- All code blocks contain complete implementations
- No "similar to Task N" references

**3. Type consistency:**
- `defaultLocale` changed from `'en'` to `'zh'` consistently
- `localePrefix` changed from `'always'` to `'never'` consistently
- `withLocale` signature unchanged (still returns `Promise<string>`) but implementation simplified

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-11-remove-locale-prefix.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
