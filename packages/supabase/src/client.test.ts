import { afterEach, describe, expect, it, vi } from 'vitest'

const createBrowser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: createBrowser,
}))

afterEach(() => {
  vi.resetModules()
  createBrowser.mockReset()
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
})

describe('createBrowserClient', () => {
  it('uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'

    const { createBrowserClient } = await import('./client')

    createBrowserClient()

    expect(createBrowser).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'sb_publishable_test',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    )
  })

  it('falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY for existing deployments', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key'

    const { createBrowserClient } = await import('./client')

    createBrowserClient()

    expect(createBrowser).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'legacy-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    )
  })

  it('prefers publishable key over anon key when both are configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key'

    const { createBrowserClient } = await import('./client')

    createBrowserClient()

    expect(createBrowser).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'sb_publishable_test',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    )
  })
})
