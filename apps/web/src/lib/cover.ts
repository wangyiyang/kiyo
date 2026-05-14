const NEGATIVE_INSTRUCTION = '画面中不得出现任何文字、字母、数字、符号或语言字符'
const FORMAT_CONSTRAINT = '正方形专辑封面，高细节，艺术插画风格'

export function buildCoverPrompt(
  type: 'album' | 'song',
  data: {
    title: string
    description?: string | null
    genre?: string | null
    mood?: string | null
  }
): string {
  const entityLabel = type === 'album' ? '专辑' : '歌曲'
  const parts: string[] = [
    `基于${entityLabel}主题"${data.title}"的视觉封面设计`,
  ]

  if (type === 'album') {
    if (data.description) {
      parts.push(`${data.description}的意境`)
    }
  } else {
    const styleParts: string[] = []
    if (data.genre) styleParts.push(`${data.genre}风格`)
    if (data.mood) styleParts.push(`${data.mood}情绪`)
    if (styleParts.length > 0) {
      parts.push(styleParts.join('，'))
    }
  }

  parts.push(FORMAT_CONSTRAINT)
  parts.push(NEGATIVE_INSTRUCTION)

  return parts.join('。')
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
