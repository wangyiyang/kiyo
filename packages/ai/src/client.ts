import { MinimaxError } from './errors'

const BASE_URL = process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com'
const TIMEOUT_MS = Number(process.env.MINIMAX_TIMEOUT_MS || '300000')
const MAX_RETRIES = Number(process.env.MINIMAX_MAX_RETRIES || '3')

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new MinimaxError('Request timed out', 'timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function minimaxFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${BASE_URL}${path}`
  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    throw new MinimaxError('MINIMAX_API_KEY is not set', 'unknown')
  }

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${apiKey}`)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let attempt = 0
  while (true) {
    try {
      const response = await fetchWithTimeout(url, {
        ...options,
        headers,
      })

      if (response.status === 429) {
        const body = await response.json().catch(() => undefined)
        throw new MinimaxError('Rate limit exceeded', 'rate_limit', 429, body)
      }

      if (!response.ok) {
        const body = await response.json().catch(() => undefined)
        throw new MinimaxError(
          `Minimax API error: ${response.status}`,
          'api_error',
          response.status,
          body
        )
      }

      return await response.json()
    } catch (err) {
      if (
        err instanceof MinimaxError &&
        (err.code === 'timeout' || err.code === 'rate_limit' || err.code === 'api_error')
      ) {
        throw err
      }

      const isLastAttempt = attempt === MAX_RETRIES
      if (isLastAttempt) {
        throw new MinimaxError(
          err instanceof Error ? err.message : 'Network request failed',
          'network'
        )
      }

      await delay(2 ** attempt * 1000)
      attempt++
    }
  }
}
