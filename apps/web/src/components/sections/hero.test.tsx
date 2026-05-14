import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'badge': 'AI Music',
      'headline.prefix': 'Let',
      'headline.highlight': 'melody',
      'headline.suffix': 'grow',
      'description': 'Description text',
      'cta.primary': 'Join Waitlist',
      'cta.primaryAuthenticated': 'Go to Dashboard',
      'cta.secondary': 'See what it does',
      'stats.models.label': 'Models',
      'stats.models.value': '5+',
      'stats.genres.label': 'Genres',
      'stats.genres.value': '30+',
      'stats.cycle.label': 'Cycle',
      'stats.cycle.value': 'Minutes',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/lib/waitlist-context', () => ({
  useWaitlist: () => ({ show: vi.fn(), hide: vi.fn(), open: false, setOpen: vi.fn() }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    dl: ({ children, ...props }: any) => <dl {...props}>{children}</dl>,
  },
  useReducedMotion: () => true,
}))

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const MockWaveform = () => <div data-testid="waveform">Waveform</div>
    MockWaveform.displayName = 'MockWaveform'
    return MockWaveform
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { Hero } from './hero'

describe('Hero', () => {
  it('renders waitlist CTA for unauthenticated users', () => {
    render(<Hero />)
    expect(screen.getByText('Join Waitlist')).toBeInTheDocument()
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument()
  })

  it('renders dashboard CTA for authenticated users', () => {
    render(<Hero isAuthenticated />)
    const dashboardLink = screen.getByText('Go to Dashboard')
    expect(dashboardLink).toBeInTheDocument()
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByText('Join Waitlist')).not.toBeInTheDocument()
  })
})
