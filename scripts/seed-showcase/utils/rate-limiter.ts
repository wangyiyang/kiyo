import { CONFIG } from '../config'

export class RateLimiter {
  private lastCallTime = 0
  private minIntervalMs: number

  constructor(type: 'lyrics' | 'songs' | 'covers') {
    this.minIntervalMs = CONFIG.rateLimits[type].delayMs
  }

  async acquire(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastCallTime
    if (elapsed < this.minIntervalMs) {
      await new Promise(r => setTimeout(r, this.minIntervalMs - elapsed))
    }
    this.lastCallTime = Date.now()
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  for (let attempt = 1; attempt <= CONFIG.retries.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[${context}] Attempt ${attempt} failed: ${message}`)

      if (attempt === CONFIG.retries.maxAttempts) {
        throw new Error(`[${context}] All ${CONFIG.retries.maxAttempts} attempts failed: ${message}`)
      }

      const delay = CONFIG.retries.baseDelayMs * 2 ** (attempt - 1)
      console.log(`[${context}] Retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Unreachable')
}
