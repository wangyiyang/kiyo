import { describe, it, expect } from 'vitest'
import { generateMusic } from '../music'
import { MinimaxError } from '../errors'

describe('generateMusic', () => {
  it('throws not-yet-implemented error', async () => {
    await expect(generateMusic({ style: 'pop' })).rejects.toBeInstanceOf(MinimaxError)
    await expect(generateMusic({ style: 'pop' })).rejects.toMatchObject({
      code: 'unknown',
      message: 'Music generation is not yet implemented',
    })
  })
})
