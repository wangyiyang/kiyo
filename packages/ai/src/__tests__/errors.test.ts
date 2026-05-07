import { describe, it, expect } from 'vitest'
import { MinimaxError } from '../errors'

describe('MinimaxError', () => {
  it('should carry code, message, statusCode, and responseBody', () => {
    const err = new MinimaxError('something broke', 'api_error', 500, { detail: 'fail' })
    expect(err.message).toBe('something broke')
    expect(err.code).toBe('api_error')
    expect(err.statusCode).toBe(500)
    expect(err.responseBody).toEqual({ detail: 'fail' })
  })

  it('should work without optional fields', () => {
    const err = new MinimaxError('timeout', 'timeout')
    expect(err.statusCode).toBeUndefined()
    expect(err.responseBody).toBeUndefined()
  })
})
