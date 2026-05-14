import { describe, it, expect } from 'vitest'
import { buildCoverPrompt } from './cover'

describe('buildCoverPrompt', () => {
  it('album: returns structured prompt without direct text embedding', () => {
    const prompt = buildCoverPrompt('album', {
      title: '夜曲',
      description: '一张关于夜晚与孤独的专辑',
    })
    expect(prompt).toContain('基于专辑主题"夜曲"的视觉封面设计')
    expect(prompt).toContain('一张关于夜晚与孤独的专辑的意境')
    expect(prompt).not.toContain('专辑:')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('album: handles missing description', () => {
    const prompt = buildCoverPrompt('album', {
      title: '无名',
    })
    expect(prompt).toContain('基于专辑主题"无名"的视觉封面设计')
    expect(prompt).toContain('正方形专辑封面，高细节，艺术插画风格')
    expect(prompt).not.toContain('undefined')
  })

  it('song: returns structured prompt with genre and mood', () => {
    const prompt = buildCoverPrompt('song', {
      title: '夏日微风',
      genre: '流行',
      mood: '轻松',
    })
    expect(prompt).toContain('基于歌曲主题"夏日微风"的视觉封面设计')
    expect(prompt).toContain('流行风格')
    expect(prompt).toContain('轻松情绪')
    expect(prompt).not.toContain('歌曲:')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('song: handles missing genre and mood', () => {
    const prompt = buildCoverPrompt('song', {
      title: '纯音乐',
    })
    expect(prompt).toContain('基于歌曲主题"纯音乐"的视觉封面设计')
    expect(prompt).not.toContain('风格：')
    expect(prompt).not.toContain('情绪：')
    expect(prompt).toContain('画面中不得出现任何文字、字母、数字、符号或语言字符')
  })

  it('always ends with negative instruction', () => {
    const albumPrompt = buildCoverPrompt('album', { title: 'A' })
    const songPrompt = buildCoverPrompt('song', { title: 'B' })
    const negative = '画面中不得出现任何文字、字母、数字、符号或语言字符'
    expect(albumPrompt.endsWith(negative)).toBe(true)
    expect(songPrompt.endsWith(negative)).toBe(true)
  })
})
