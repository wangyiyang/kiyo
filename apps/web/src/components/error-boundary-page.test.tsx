import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { ErrorBoundaryPage } from './error-boundary-page'

describe('ErrorBoundaryPage', () => {
  it('renders friendly copy and digest without exposing raw message', () => {
    render(
      <ErrorBoundaryPage
        error={Object.assign(new Error('database password leaked'), {
          digest: 'abc123',
        })}
        reset={vi.fn()}
        homeHref="/zh"
      />
    )

    expect(screen.getByRole('heading', { name: '出错了' })).toBeInTheDocument()
    expect(screen.getByText('错误 ID: abc123')).toBeInTheDocument()
    expect(screen.queryByText('database password leaked')).not.toBeInTheDocument()
  })

  it('calls reset when retry is clicked', () => {
    const reset = vi.fn()

    render(
      <ErrorBoundaryPage
        error={new Error('render failed')}
        reset={reset}
        homeHref="/"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /重试/i }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('links back to the provided home href', () => {
    render(
      <ErrorBoundaryPage
        error={new Error('render failed')}
        reset={vi.fn()}
        homeHref="/en"
      />
    )

    expect(screen.getByRole('link', { name: /返回首页/i })).toHaveAttribute(
      'href',
      '/en'
    )
  })
})