/**
 * 已知的中文标签到英文的映射表
 * 键为原始输入（小写、去空格后），值为标准化后的英文标签
 */
const TAG_MAPPINGS: Record<string, string> = {
  '伤感': 'sentimental',
  '流行': 'pop',
  '悲伤': 'melancholic',
  '快乐': 'happy',
  '兴奋': 'energetic',
  '安静': 'peaceful',
  '温柔': 'warm',
}

/**
 * 标准化单个标签：
 * 1. 空值保护
 * 2. 去前后空格
 * 3. 转为小写
 * 4. 中文映射到英文
 * 5. 复合标签（含逗号）：保留第一个最具体的子标签
 * 6. 去除多余空格
 */
export function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag || typeof tag !== 'string') return null

  let normalized = tag.trim().toLowerCase()

  // 中文映射
  if (TAG_MAPPINGS[normalized]) {
    return TAG_MAPPINGS[normalized]
  }

  // 复合标签处理：逗号分隔时保留第一部分
  if (normalized.includes(',')) {
    normalized = normalized.split(',')[0].trim()
  }

  // 拆分后再次检查中文映射
  if (TAG_MAPPINGS[normalized]) {
    return TAG_MAPPINGS[normalized]
  }

  // 去除多余空格
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized || null
}

/**
 * 批量标准化标签数组，过滤空值和重复值
 */
export function normalizeTagList(tags: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const tag of tags) {
    const normalized = normalizeTag(tag)
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }

  return result
}
