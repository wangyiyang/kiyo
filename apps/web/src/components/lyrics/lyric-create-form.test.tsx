import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'

import { LyricCreateForm } from './lyric-create-form'
import zhMessages from '../../../messages/zh.json'

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      {children}
    </NextIntlClientProvider>
  )
}

describe('LyricCreateForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders all fields', () => {
    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    expect(screen.getByLabelText(/标题/)).toBeInTheDocument()
    expect(screen.getByLabelText(/语言/)).toBeInTheDocument()
    expect(screen.getByLabelText(/风格/)).toBeInTheDocument()
    expect(screen.getByLabelText(/情绪/)).toBeInTheDocument()
    expect(screen.getByLabelText(/内容/)).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.getByText('标题不能为空')).toBeInTheDocument()
      expect(screen.getByText('内容不能为空')).toBeInTheDocument()
    })
  })

  it('submits with correct payload when valid', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ lyric: { id: 'lyric-123' } }),
    })
    global.fetch = mockFetch

    const onSuccess = vi.fn()

    render(
      <Wrapper>
        <LyricCreateForm onSuccess={onSuccess} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/标题/), {
      target: { value: '测试歌词' },
    })
    fireEvent.change(screen.getByLabelText(/内容/), {
      target: { value: '这是歌词内容' },
    })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/lyrics',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('测试歌词'),
        })
      )
      expect(onSuccess).toHaveBeenCalledWith('lyric-123')
    })
  })

  it('shows server error on failed submission', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 'UNAUTHORIZED' } }),
    })
    global.fetch = mockFetch

    render(
      <Wrapper>
        <LyricCreateForm onSuccess={vi.fn()} />
      </Wrapper>
    )

    fireEvent.change(screen.getByLabelText(/标题/), {
      target: { value: '测试歌词' },
    })
    fireEvent.change(screen.getByLabelText(/内容/), {
      target: { value: '这是歌词内容' },
    })

    fireEvent.click(screen.getByText('保存'))

    await waitFor(() => {
      expect(screen.getByText(/请先登录后再进行操作/)).toBeInTheDocument()
    })
  })
})
