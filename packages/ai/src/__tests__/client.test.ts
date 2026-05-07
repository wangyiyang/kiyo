process.env.MINIMAX_TIMEOUT_MS = '50'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { minimaxFetch } from '../client'
import { MinimaxError } from '../errors'

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  process.env.MINIMAX_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.useRealTimers()
  delete process.env.MINIMAX_API_KEY
})

describe('minimaxFetch', () => {
  it('returns JSON on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'ok' }),
    } as Response)

    const result = await minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    expect(result).toEqual({ result: 'ok' })
  })

  it('retries on network error then succeeds', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'ok' }),
      } as Response)

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise
    expect(result).toEqual({ result: 'ok' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws MinimaxError(timeout) when request exceeds timeout', async () => {
    globalThis.fetch = vi.fn((_url: string | URL | Request, options?: RequestInit) => {
      return new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    })

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    vi.advanceTimersByTime(100)
    await expect(promise).rejects.toMatchObject({ code: 'timeout' })
  }, 10000)

  it('throws MinimaxError(rate_limit) on 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: 'too many requests' }),
    } as Response)

    await expect(minimaxFetch('/v1/test', { body: JSON.stringify({}) }))
      .rejects.toMatchObject({ code: 'rate_limit', statusCode: 429 })
  })

  it('throws MinimaxError(api_error) on 4xx/5xx with body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    } as Response)

    await expect(minimaxFetch('/v1/test', { body: JSON.stringify({}) }))
      .rejects.toMatchObject({ code: 'api_error', statusCode: 400, responseBody: { error: 'bad request' } })
  })

  it('exhausts retries then throws MinimaxError(network)', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET'))

    const promise = minimaxFetch('/v1/test', { body: JSON.stringify({}) })
    const rejection = expect(promise).rejects.toThrow(MinimaxError)
    await vi.advanceTimersByTimeAsync(15000)
    await rejection
    expect(globalThis.fetch).toHaveBeenCalledTimes(4)
  })
})
