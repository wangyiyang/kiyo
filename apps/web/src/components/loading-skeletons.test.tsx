import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { renderWithIntl } from '@/test-utils/intl'

import {
  AlbumsListSkeleton,
  GlobalPageSkeleton,
  SongsListSkeleton,
} from './loading-skeletons'

describe('loading skeletons', () => {
  it('renders global loading status', () => {
    renderWithIntl(<GlobalPageSkeleton />)

    expect(screen.getByRole('status', { name: '页面加载中' })).toBeInTheDocument()
  })

  it('renders six song card placeholders', () => {
    renderWithIntl(<SongsListSkeleton />)

    expect(screen.getByRole('status', { name: '歌曲列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('song-card-skeleton')).toHaveLength(6)
  })

  it('renders six album card placeholders', () => {
    renderWithIntl(<AlbumsListSkeleton />)

    expect(screen.getByRole('status', { name: '专辑列表加载中' })).toBeInTheDocument()
    expect(screen.getAllByTestId('album-card-skeleton')).toHaveLength(6)
  })
})
