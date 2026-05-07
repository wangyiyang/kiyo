import { minimaxFetch } from './client'

export interface GenerateTextOptions {
  systemPrompt?: string
  userPrompt: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface GenerateTextResult {
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}

export async function generateText(
  options: GenerateTextOptions
): Promise<GenerateTextResult> {
  const messages: Array<{ role: string; content: string }> = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: options.userPrompt })

  const body = {
    model: options.model,
    messages,
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  }

  const response = await minimaxFetch('/v1/text/chatcompletion_v2', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('Invalid response from text generation API')
  }

  return {
    text,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
        }
      : undefined,
  }
}
