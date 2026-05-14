import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthGuardButton } from './auth-guard-button'

vi.mock('@kiyo/supabase', () => ({
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
    const { createBrowserClient } = await import('@kiyo/supabase')
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
    const { createBrowserClient } = await import('@kiyo/supabase')
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