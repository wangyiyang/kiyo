import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureAppException = vi.fn()
const insert = vi.fn()
const getHeader = vi.fn(() => 'Vitest')

vi.mock('@/lib/monitoring', () => ({
  captureAppException,
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: getHeader,
  })),
}))

vi.mock('@kiyo/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      insert,
    })),
  })),
}))

describe('waitlist action monitoring', () => {
  beforeEach(() => {
    captureAppException.mockClear()
    insert.mockReset()
    getHeader.mockClear()
  })

  it('captures insert failures', async () => {
    const error = { code: 'PGRST500', message: 'database unavailable' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'producer',
    })

    expect(result).toEqual({
      ok: false,
      code: 'UNKNOWN',
      message: '提交失败，请稍后再试',
    })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role: 'producer',
      source: 'landing',
      user_agent: 'Vitest',
    })
    expect(captureAppException).toHaveBeenCalledWith(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
  })
})