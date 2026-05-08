import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import { MobileNavSheet } from './mobile-nav-sheet'

const mockT = (key: string) => {
  const map: Record<string, string> = {
    openMenu: 'Open navigation menu',
    menu: 'Menu',
    songs: 'Songs',
    albums: 'Albums',
    lyrics: 'Lyrics',
    language: 'Language',
    theme: 'Theme',
  }
  return map[key] ?? key
}

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('./LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher">LocaleSwitcher</div>,
}))

vi.mock('./theme-toggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">ThemeToggle</div>,
}))

describe('MobileNavSheet', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders trigger button with correct aria-label', () => {
    render(<MobileNavSheet />)
    expect(
      screen.getByRole('button', { name: /Open navigation menu/i })
    ).toBeInTheDocument()
  })

  it('opens sheet when trigger is clicked', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /Songs/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Albums/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lyrics/i })).toBeInTheDocument()
  })

  it('closes sheet when a nav link is clicked', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('link', { name: /Songs/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes sheet on ESC key', async () => {
    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes sheet when matchMedia crosses md breakpoint', async () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (
          _event: string,
          handler: (e: MediaQueryListEvent) => void
        ) => {
          changeHandler = handler
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    render(<MobileNavSheet />)
    fireEvent.click(
      screen.getByRole('button', { name: /Open navigation menu/i })
    )
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    changeHandler?.({ matches: true } as MediaQueryListEvent)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
