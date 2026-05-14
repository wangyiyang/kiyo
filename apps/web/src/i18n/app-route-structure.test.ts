import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDir = path.join(srcDir, 'app')
const localizedAppDir = path.join(appDir, '[locale]')

const localizedRouteFiles = [
  'page.tsx',
  'albums/page.tsx',
  'albums/loading.tsx',
  'albums/[id]/page.tsx',
  'contact/page.tsx',
  'error.tsx',
  'explore/page.tsx',
  'forgot-password/page.tsx',
  'loading.tsx',
  'login/page.tsx',
  'lyrics/page.tsx',
  'lyrics/generate/page.tsx',
  'lyrics/new/page.tsx',
  'lyrics/[id]/page.tsx',
  'lyrics/[id]/edit/page.tsx',
  'not-found.tsx',
  'privacy/page.tsx',
  'register/page.tsx',
  'reset-password/page.tsx',
  'settings/page.tsx',
  'songs/page.tsx',
  'songs/loading.tsx',
  'songs/cover/page.tsx',
  'songs/new/page.tsx',
  'songs/[id]/page.tsx',
  'songs/[id]/edit/page.tsx',
  'terms/page.tsx',
]

const rootRouteFiles = [
  'api/songs/route.ts',
  'auth/callback/route.ts',
  'globals.css',
  'layout.tsx',
  'providers.tsx',
  'robots.ts',
  'sitemap.ts',
]

/**
 * Find all immediate subdirectories of a directory.
 * Used to discover Route Groups like (site) and (dashboard).
 */
function getSubdirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() && !name.startsWith('_')
  })
}

/**
 * Check if a route file exists under app/[locale] or any of its Route Group subdirectories.
 * Route Groups (directories wrapped in parentheses) do not affect the URL.
 */
function localizedRouteExists(routeFile: string): boolean {
  if (existsSync(path.join(localizedAppDir, routeFile))) return true

  const subdirs = getSubdirs(localizedAppDir)
  for (const subdir of subdirs) {
    if (existsSync(path.join(localizedAppDir, subdir, routeFile))) return true
  }
  return false
}

describe('i18n app route structure', () => {
  it('keeps public page routes under app/[locale] for internal locale rewrites', () => {
    const missingRoutes = localizedRouteFiles.filter(
      (routeFile) => !localizedRouteExists(routeFile),
    )

    expect(missingRoutes).toEqual([])
  })

  it('keeps api, auth, and app infrastructure routes at the app root', () => {
    const missingRoutes = rootRouteFiles.filter(
      (routeFile) => !existsSync(path.join(appDir, routeFile)),
    )

    expect(missingRoutes).toEqual([])
  })
})
