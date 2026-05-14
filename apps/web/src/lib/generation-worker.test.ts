import { beforeEach, describe, expect, it, vi } from 'vitest'
import { triggerGenerationWorker } from './generation-worker'
import { createServiceRoleClient } from '@kiyo/supabase/server'

vi.mock('@kiyo/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
})

describe('triggerGenerationWorker', () => {
  it('invokes the process-generation-task edge function', () => {
    const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient)
    const invoke = vi.fn().mockResolvedValue({ data: { processed: 0 }, error: null })
    mockedCreateServiceRoleClient.mockReturnValue({ functions: { invoke } } as any)

    triggerGenerationWorker()

    expect(invoke).toHaveBeenCalledWith('process-generation-task')
  })

  it('does not throw when service role client is not configured', () => {
    const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedCreateServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
    })

    expect(() => triggerGenerationWorker()).not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith('Failed to trigger generation worker:', expect.any(Error))

    consoleSpy.mockRestore()
  })

  it('logs resolved edge function errors', async () => {
    const mockedCreateServiceRoleClient = vi.mocked(createServiceRoleClient)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = { message: 'Function not found' }
    mockedCreateServiceRoleClient.mockReturnValue({
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error }),
      },
    } as any)

    triggerGenerationWorker()
    await Promise.resolve()

    expect(consoleSpy).toHaveBeenCalledWith('Failed to trigger generation worker:', error)

    consoleSpy.mockRestore()
  })
})
