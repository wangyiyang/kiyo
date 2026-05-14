import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StructuredBlockViewer } from '../structured-block-viewer'

describe('StructuredBlockViewer', () => {
  it('renders blocks with tags and content', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Line 1\nLine 2' },
      { id: '2', tag: 'Chorus', content: 'Chorus line' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.getByText('[Verse]')).toBeInTheDocument()
    expect(screen.getByText(/Line 1/)).toBeInTheDocument()
    expect(screen.getByText(/Line 2/)).toBeInTheDocument()
    expect(screen.getByText('[Chorus]')).toBeInTheDocument()
    expect(screen.getByText('Chorus line')).toBeInTheDocument()
  })

  it('renders placeholder for empty content', () => {
    const blocks = [{ id: '1', tag: 'Intro', content: '' }]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.getByText('[Intro]')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('does not render input or textarea elements', () => {
    const blocks = [
      { id: '1', tag: 'Verse', content: 'Some lyrics' },
    ]

    render(<StructuredBlockViewer blocks={blocks} />)

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const blocks = [{ id: '1', tag: 'Text', content: 'Hello' }]

    const { container } = render(
      <StructuredBlockViewer blocks={blocks} className="my-custom-class" />
    )

    expect(container.querySelector('article')).toHaveClass('my-custom-class')
  })
})
