export function buildLyricsPrompt(params: {
  prompt: string
  language?: string
  style?: string
  mood?: string
}): string {
  const parts = [params.prompt]
  if (params.language) parts.push(`语言：${params.language}`)
  if (params.style) parts.push(`风格：${params.style}`)
  if (params.mood) parts.push(`情绪：${params.mood}`)
  return parts.join('，')
}
