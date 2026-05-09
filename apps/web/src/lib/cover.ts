export function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  if (type === 'album') {
    return data.description
      ? `专辑: ${data.title}。${data.description}`
      : `专辑: ${data.title}`
  }
  const parts = [`歌曲: ${data.title}`]
  if (data.genre) parts.push(`风格：${data.genre}`)
  if (data.mood) parts.push(`情绪：${data.mood}`)
  return parts.join('，')
}

export async function downloadImage(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to download generated image')
  }
  return res.arrayBuffer()
}

export async function uploadToCovers(
  supabase: any,
  filePath: string,
  buffer: ArrayBuffer
): Promise<string> {
  const { error } = await supabase.storage
    .from('covers')
    .upload(filePath, buffer, { contentType: 'image/png' })
  if (error) throw new Error(error.message || 'Storage upload failed')
  const { data } = supabase.storage.from('covers').getPublicUrl(filePath)
  return data.publicUrl
}
