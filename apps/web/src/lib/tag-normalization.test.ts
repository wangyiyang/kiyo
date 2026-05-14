import { describe, it, expect } from 'vitest'
import { normalizeTag, normalizeTagList } from './tag-normalization'

describe('normalizeTag', () => {
  it('returns null for empty/whitespace input', () => {
    expect(normalizeTag(null)).toBeNull()
    expect(normalizeTag(undefined)).toBeNull()
    expect(normalizeTag('')).toBeNull()
    expect(normalizeTag('   ')).toBeNull()
  })

  it('trims and lowercases tags', () => {
    expect(normalizeTag('  Melancholic  ')).toBe('melancholic')
    expect(normalizeTag('Energetic')).toBe('energetic')
  })

  it('maps Chinese tags to English', () => {
    expect(normalizeTag('伤感')).toBe('sentimental')
    expect(normalizeTag('流行')).toBe('pop')
    expect(normalizeTag('  伤感  ')).toBe('sentimental')
  })

  it('splits compound tags on comma keeping first part', () => {
    expect(normalizeTag('electropop, bright, short')).toBe('electropop')
    expect(normalizeTag('  Pop, Dance, Electronic  ')).toBe('pop')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeTag('dreamy   pop')).toBe('dreamy pop')
  })
})

describe('normalizeTagList', () => {
  it('filters nulls and deduplicates', () => {
    expect(normalizeTagList(['伤感', '流行', null, '伤感'])).toEqual([
      'sentimental',
      'pop',
    ])
  })

  it('returns empty array for all invalid input', () => {
    expect(normalizeTagList([null, undefined, ''])).toEqual([])
  })
})
