import { describe, it, expect } from 'vitest'
import { textToBlocks, blocksToText, Block } from '../blocks'

describe('textToBlocks', () => {
  it('parses tagged sections into blocks', () => {
    const input = '[Verse]\nLine 1\nLine 2\n[Chorus]\nChorus line'
    const result = textToBlocks(input)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ tag: 'Verse', content: 'Line 1\nLine 2' })
    expect(result[1]).toMatchObject({ tag: 'Chorus', content: 'Chorus line' })
    expect(result[0].id).toBeDefined()
    expect(result[1].id).toBeDefined()
  })

  it('trims whitespace around tags and content', () => {
    const input = '  [Verse]  \n  Line 1  \n  Line 2  \n  [Chorus]  \n  Chorus line  '
    const result = textToBlocks(input)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ tag: 'Verse', content: 'Line 1  \n  Line 2' })
    expect(result[1]).toMatchObject({ tag: 'Chorus', content: 'Chorus line' })
  })

  it('wraps untagged text in a default Text block', () => {
    const input = 'Hello world\nMore text'
    const result = textToBlocks(input)
    expect(result).toEqual([
      expect.objectContaining({ tag: 'Text', content: 'Hello world\nMore text' }),
    ])
  })

  it('returns a single Text block for empty input', () => {
    const result = textToBlocks('')
    expect(result).toEqual([
      expect.objectContaining({ tag: 'Text', content: '' }),
    ])
  })

  it('returns a single Text block for whitespace-only input', () => {
    const result = textToBlocks('   \n   ')
    expect(result).toEqual([
      expect.objectContaining({ tag: 'Text', content: '' }),
    ])
  })
})

describe('blocksToText', () => {
  it('serializes blocks to tagged text', () => {
    const blocks: Block[] = [
      { id: 'a', tag: 'Verse', content: 'Line 1\nLine 2' },
      { id: 'b', tag: 'Chorus', content: 'Chorus line' },
    ]
    const result = blocksToText(blocks)
    expect(result).toBe('[Verse]\nLine 1\nLine 2\n\n[Chorus]\nChorus line')
  })

  it('handles empty content blocks', () => {
    const blocks: Block[] = [
      { id: 'a', tag: 'Verse', content: '' },
      { id: 'b', tag: 'Chorus', content: 'Chorus line' },
    ]
    const result = blocksToText(blocks)
    expect(result).toBe('[Verse]\n\n[Chorus]\nChorus line')
  })
})

describe('roundtrip', () => {
  it('text -> blocks -> text preserves structure', () => {
    const input = '[Verse]\nLine 1\nLine 2\n\n[Chorus]\nChorus line'
    const blocks = textToBlocks(input)
    const output = blocksToText(blocks)
    expect(output).toBe('[Verse]\nLine 1\nLine 2\n\n[Chorus]\nChorus line')
  })
})
