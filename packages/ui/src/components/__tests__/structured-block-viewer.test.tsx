import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { StructuredBlockViewer } from '../structured-block-viewer'

describe('StructuredBlockViewer', () => {
  it('renders blocks with tags and content as collapsible sections', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Line 1\nLine 2' },
      { id: '2', tag: 'Chorus', content: 'Chorus line' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    // 主歌/副歌 是 verse/chorus 的中文翻译
    expect(screen.getByText('主歌')).toBeInTheDocument()
    expect(screen.getByText('副歌')).toBeInTheDocument()

    // 默认折叠，需要点击展开查看内容
    expect(screen.queryByText(/Line 1/)).not.toBeInTheDocument()
  })

  it('renders placeholder for empty content after expand', () => {
    const blocks = [{ id: '1', tag: 'Intro', content: '' }]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.getByText('引子')).toBeInTheDocument()

    // Click to expand and see the placeholder
    const trigger = screen.getByRole('button', { name: /引子/i })
    fireEvent.click(trigger)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders as accordion with buttons for triggering', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Some lyrics' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    // Accordion 使用 button 触发器
    expect(screen.getByRole('button')).toBeInTheDocument()
    // 没有 textbox
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('applies custom className to accordion root', () => {
    const blocks = [{ id: '1', tag: 'Text', content: 'Hello' }]

    const { container } = render(
      <StructuredBlockViewer blocks={blocks} className="my-custom-class" />
    )

    // 根元素现在是 div (Accordion)
    expect(container.querySelector('[class*="my-custom-class"]')).toBeInTheDocument()
  })

  it('handles verse with number suffix', () => {
    const blocks = [
      { id: '1', tag: 'Verse 1', content: 'First verse content' },
      { id: '2', tag: 'Verse 2', content: 'Second verse content' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    // 带数字的标签应该显示为 "主歌 1" 形式
    expect(screen.getByText('主歌 1')).toBeInTheDocument()
    expect(screen.getByText('主歌 2')).toBeInTheDocument()
  })

  it('renders unknown tag types with default style', () => {
    const blocks = [
      { id: '1', tag: 'CustomTag', content: 'Custom content' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    // 未知标签显示为 "段落"
    expect(screen.getByText('段落')).toBeInTheDocument()
  })
})