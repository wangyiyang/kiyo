export type MinimaxErrorCode = 'network' | 'timeout' | 'rate_limit' | 'api_error' | 'unknown' | 'not_supported'

export class MinimaxError extends Error {
  constructor(
    message: string,
    public code: MinimaxErrorCode,
    public statusCode?: number,
    public responseBody?: unknown
  ) {
    super(message)
    this.name = 'MinimaxError'
  }
}
