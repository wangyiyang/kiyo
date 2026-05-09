import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import {
  AlbumsListSkeleton,
  GlobalPageSkeleton,
  SongsListSkeleton,
} from './loading-skeletons'

describe('loading skeletons', () => {
  it('renders global loading status', () => {
    render(<GlobalPageSkeleton />)

    expect(screen.getByRole('status', { name: '页面加载中' })).toBeInTheDocument()
  })

  it('renders six song card placeholders', () => {
    render(<SongsListSkeleton />)

    expect(screen.getByRole('status', { name: '歌曲列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('song-card-skeleton')).toHaveLength(6)
  })

  it('renders six album card placeholders', () => {
    render(<AlbumsListSkeleton />)

    expect(screen.getByRole('status', { name: '专辑列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card-skeleton')).toHaveLength(6)
  })
})