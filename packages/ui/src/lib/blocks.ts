export interface Block {
  id: string
  tag: string
  content: string
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function textToBlocks(text: string): Block[] {
  if (!text.trim()) {
    return [{ id: generateId(), tag: 'Text', content: '' }]
  }

  const lines = text.split('\n')
  const blocks: Block[] = []
  let currentTag = 'Text'
  let currentContent: string[] = []

  const flushBlock = () => {
    if (currentContent.length > 0) {
      blocks.push({
        id: generateId(),
        tag: currentTag,
        content: currentContent.join('\n').trim(),
      })
      currentContent = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const tagMatch = trimmed.match(/^\[(.+?)\]$/)
    if (tagMatch) {
      flushBlock()
      currentTag = tagMatch[1].trim()
    } else {
      currentContent.push(line)
    }
  }

  flushBlock()
  return blocks
}

export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      const tagLine = `[${block.tag}]`
      if (!block.content.trim()) return tagLine
      return `${tagLine}\n${block.content}`
    })
    .join('\n\n')
}
