import type { ProviderName } from './types'

type TaskType = 'lyrics' | 'text' | 'image' | 'music' | 'cover'

const DEFAULT_PROVIDERS: Record<TaskType, ProviderName> = {
  lyrics: 'minimax',
  text: 'gmi',
  image: 'minimax',
  music: 'minimax',
  cover: 'minimax',
}

export function getProviderForTask(task: TaskType): ProviderName {
  const envVar = `PROVIDER_${task.toUpperCase()}`
  const provider = process.env[envVar] as ProviderName | undefined
  return provider ?? DEFAULT_PROVIDERS[task]
}

export function getProviderConfig(provider: ProviderName) {
  switch (provider) {
    case 'gmi':
      return {
        name: 'gmi' as const,
        apiKey: process.env.GMI_API_KEY ?? '',
        baseUrl: process.env.GMI_BASE_URL ?? 'https://api.gmi-serving.com',
        timeoutMs: Number(process.env.GMI_TIMEOUT_MS ?? '120000'),
        maxRetries: Number(process.env.GMI_MAX_RETRIES ?? '3'),
        defaultModel: process.env.GMI_DEFAULT_MODEL ?? 'deepseek-ai/DeepSeek-V4-Flash',
      }
    case 'minimax':
      return {
        name: 'minimax' as const,
        apiKey: process.env.MINIMAX_API_KEY ?? '',
        baseUrl: process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com',
        timeoutMs: Number(process.env.MINIMAX_TIMEOUT_MS ?? '300000'),
        maxRetries: Number(process.env.MINIMAX_MAX_RETRIES ?? '3'),
      }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
