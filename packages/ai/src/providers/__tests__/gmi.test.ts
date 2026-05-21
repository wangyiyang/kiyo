import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGmiProvider } from '../gmi'
import { ProviderError } from '../types'

const originalFetch = globalThis.fetch

describe('GMI Provider', () => {
  beforeEach(() => {
    process.env.GMI_API_KEY = 'test-gmi-key'
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    delete process.env.GMI_API_KEY
    delete process.env.GMI_DEFAULT_MODEL
    globalThis.fetch = originalFetch
  })

  it('generateLyrics sends correct request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Generated lyrics' } }],
      }),
    } as Response)
    globalThis.fetch = fetchMock

    const provider = createGmiProvider()
    const result = await provider.generateLyrics!({ prompt: 'test prompt' })

    expect(result.text).toBe('Generated lyrics')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(requestInit.body)
    expect(body.model).toBe('deepseek-ai/DeepSeek-V4-Flash')
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('test prompt')
    expect(body.temperature).toBe(0.8)
    expect(body.max_tokens).toBe(2000)
  })

  it('generateLyrics uses custom model from env', async () => {
    process.env.GMI_DEFAULT_MODEL = 'Qwen/Qwen3.6-Plus'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Lyrics' } }],
      }),
    } as Response)
    globalThis.fetch = fetchMock

    const provider = createGmiProvider()
    await provider.generateLyrics!({ prompt: 'test' })

    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(requestInit.body)
    expect(body.model).toBe('Qwen/Qwen3.6-Plus')
  })

  it('generateText uses provided model over default', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Hello' } }],
      }),
    } as Response)
    globalThis.fetch = fetchMock

    const provider = createGmiProvider()
    await provider.generateText!({ userPrompt: 'hi', model: 'custom-model' })

    const [, requestInit] = fetchMock.mock.calls[0]
    const body = JSON.parse(requestInit.body)
    expect(body.model).toBe('custom-model')
  })

  it('throws ProviderError on API failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    } as Response)

    const provider = createGmiProvider()
    await expect(provider.generateLyrics!({ prompt: 'test' })).rejects.toBeInstanceOf(ProviderError)
  })

  it('throws ProviderError when response is missing content', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: {} }] }),
    } as Response)

    const provider = createGmiProvider()
    await expect(provider.generateLyrics!({ prompt: 'test' })).rejects.toBeInstanceOf(ProviderError)
  })
})
