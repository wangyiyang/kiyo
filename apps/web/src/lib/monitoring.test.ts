import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  captureException,
}))

describe('captureAppException', () => {
  beforeEach(() => {
    captureException.mockClear()
  })

  it('captures errors with tags and context', async () => {
    const { captureAppException } = await import('./monitoring')
    const error = new Error('generation failed')

    captureAppException(error, {
      tags: { area: 'lyrics', operation: 'generate' },
      extra: { lyricId: 'lyric_123' },
    })

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { area: 'lyrics', operation: 'generate' },
      extra: { lyricId: 'lyric_123' },
    })
  })

  it('normalizes non-error values before capture', async () => {
    const { captureAppException } = await import('./monitoring')

    captureAppException('plain failure', {
      tags: { area: 'waitlist' },
    })

    expect(captureException).toHaveBeenCalledTimes(1)
    const [capturedError, context] = captureException.mock.calls[0]
    expect(capturedError).toBeInstanceOf(Error)
    expect(capturedError.message).toBe('plain failure')
    expect(context).toEqual({ tags: { area: 'waitlist' } })
  })

  it('preserves plain object error message and code', async () => {
    const { captureAppException } = await import('./monitoring')
    const error = { code: 'PGRST500', message: 'database unavailable' }

    captureAppException(error, {
      tags: { area: 'waitlist', operation: 'insert' },
      extra: { email: 'listener@example.com' },
    })

    expect(captureException).toHaveBeenCalledTimes(1)
    const [capturedError, context] = captureException.mock.calls[0]
    expect(capturedError).toBeInstanceOf(Error)
    expect(capturedError.message).toBe('PGRST500: database unavailable')
    expect(context).toEqual({
      tags: { area: 'waitlist', operation: 'insert' },
      extra: {
        email: 'listener@example.com',
        originalError: error,
      },
    })
  })
})
