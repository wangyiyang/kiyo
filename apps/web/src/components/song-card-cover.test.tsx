import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt, ...props }: { alt: string }) => <img alt={alt} {...props} />,
}))

import { SongCard } from '@kiyo/ui'

describe('SongCard onCover', () => {
  it('renders cover button when onCover is provided', () => {
    const onCover = vi.fn()
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
        onCover={onCover}
      />
    )

    expect(screen.getByRole('button', { name: /翻唱/i })).toBeInTheDocument()
  })

  it('does not render cover button when onCover is omitted', () => {
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
      />
    )

    expect(screen.queryByRole('button', { name: /翻唱/i })).not.toBeInTheDocument()
  })

  it('calls onCover with song id when clicked', () => {
    const onCover = vi.fn()
    render(
      <SongCard
        id="s1"
        title="测试歌曲"
        status="completed"
        statusLabel="已完成"
        href="/songs/s1"
        onCover={onCover}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /翻唱/i }))
    expect(onCover).toHaveBeenCalledWith('s1')
    expect(onCover).toHaveBeenCalledTimes(1)
  })
})
