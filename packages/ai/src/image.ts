import { minimaxFetch } from './client'

export interface GenerateImageOptions {
  prompt: string
  width?: number
  height?: number
  model?: string
}

export interface GenerateImageResult {
  imageUrl: string
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResult> {
  const body = {
    prompt: options.prompt,
    width: options.width,
    height: options.height,
    model: options.model || 'image-01',
  }

  const response = await minimaxFetch('/v1/image_generation', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const data = response as { data?: { image_urls?: string[] } }
  const imageUrl = data.data?.image_urls?.[0]

  if (!imageUrl) {
    throw new Error('Invalid response from image generation API')
  }

  return { imageUrl }
}
