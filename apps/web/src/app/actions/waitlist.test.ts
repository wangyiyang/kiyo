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

describe('waitlist action', () => {
  beforeEach(() => {
    captureAppException.mockClear()
    insert.mockReset()
    getHeader.mockClear()
  })

  it('inserts with new columns', async () => {
    insert.mockReturnValue({ error: null })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'indie',
      interests: ['composition', 'cover'],
      useScenes: ['personal'],
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role_new: 'indie',
      interests: ['composition', 'cover'],
      use_scenes: ['personal'],
      source: 'landing',
      user_agent: 'Vitest',
    })
  })

  it('inserts with only email (optional fields omitted)', async () => {
    insert.mockReturnValue({ error: null })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'minimal@example.com',
    })

    expect(result).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith({
      email: 'minimal@example.com',
      role_new: null,
      interests: null,
      use_scenes: null,
      source: 'landing',
      user_agent: 'Vitest',
    })
  })

  it('captures insert failures', async () => {
    const error = { code: 'PGRST500', message: 'database unavailable' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'listener@example.com',
      role: 'professional',
    })

    expect(result).toEqual({
      ok: false,
      code: 'UNKNOWN',
      message: '提交失败，请稍后再试',
    })
    expect(insert).toHaveBeenCalledWith({
      email: 'listener@example.com',
      role_new: 'professional',
      interests: null,
      use_scenes: null,
      source: 'landing',
      user_agent: 'Vitest',
    })
    expect(captureAppException).toHaveBeenCalledWith(error, {
      tags: { area: 'waitlist', operation: 'insert' },
    })
  })

  it('handles duplicate email', async () => {
    const error = { code: '23505', message: 'unique violation' }
    insert.mockReturnValue({ error })
    const { joinWaitlist } = await import('./waitlist')

    const result = await joinWaitlist({
      email: 'dup@example.com',
    })

    expect(result).toEqual({
      ok: false,
      code: 'DUPLICATE',
      message: '该邮箱已在 Waitlist 中，感谢支持',
    })
  })
})
