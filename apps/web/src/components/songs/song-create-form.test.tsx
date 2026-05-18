import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'

import { SongCreateForm } from './song-create-form'
import zhMessages from '../../../messages/zh.json'

const mockLyrics = [
  { id: 'lyric-1', title: '歌词一' },
  { id: 'lyric-2', title: '歌词二' },
]

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('SongCreateForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders all fields', () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    expect(screen.getByLabelText(/歌曲名称/)).toBeInTheDocument()
    expect(screen.getByLabelText(/主题描述/)).toBeInTheDocument()
    expect(screen.getByLabelText(/风格/)).toBeInTheDocument()
    expect(screen.getByLabelText(/情绪/)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('开始创作')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText('歌曲名称不能为空')).toBeInTheDocument()
      expect(screen.getByText('主题描述不能为空')).toBeInTheDocument()
    })
  })

  it('shows conditional lyricId error when existing_lyric mode selected', async () => {
    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    // Select existing_lyric mode
    fireEvent.click(screen.getByText('已有歌词'))

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText('请选择关联歌词')).toBeInTheDocument()
    })
  })

  it('submits with correct payload when valid', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ song: { id: 'song-123' } }),
    })
    global.fetch = mockFetch

    const onSuccess = vi.fn()

    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={onSuccess} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/歌曲名称/), {
      target: { value: '测试歌曲' },
    })
    fireEvent.change(screen.getByLabelText(/主题描述/), {
      target: { value: '一首测试歌曲' },
    })

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/songs/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('测试歌曲'),
        })
      )
      expect(onSuccess).toHaveBeenCalledWith('song-123')
    })
  })

  it('shows server error on failed submission', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'VALIDATION_ERROR' } }),
    })
    global.fetch = mockFetch

    render(
      <Wrapper>
        <SongCreateForm lyrics={mockLyrics} onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/歌曲名称/), {
      target: { value: '测试歌曲' },
    })
    fireEvent.change(screen.getByLabelText(/主题描述/), {
      target: { value: '一首测试歌曲' },
    })

    fireEvent.click(screen.getByText('开始创作'))

    await waitFor(() => {
      expect(screen.getByText(/请检查输入内容是否正确/)).toBeInTheDocument()
    })
  })
})
