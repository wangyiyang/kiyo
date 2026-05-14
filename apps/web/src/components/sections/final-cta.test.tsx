import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'headline.prefix': 'Turn',
      'headline.highlight': 'melody',
      'headline.suffix': 'into track',
      'description': 'Join waitlist',
      'authenticated.headline': 'Welcome back',
      'authenticated.description': 'Next melody waiting',
      'authenticated.cta': 'Go to Dashboard',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('../scroll-reveal', () => ({
  ScrollReveal: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('../inline-waitlist-form', () => ({
  InlineWaitlistForm: () => <div data-testid="waitlist-form">Waitlist Form</div>,
}))

import { FinalCta } from './final-cta'

describe('FinalCta', () => {
  it('renders waitlist form for unauthenticated users', () => {
    render(<FinalCta />)
    expect(screen.getByTestId('waitlist-form')).toBeInTheDocument()
    expect(screen.queryByText('Welcome back')).not.toBeInTheDocument()
  })

  it('renders authenticated CTA for authenticated users', () => {
    render(<FinalCta isAuthenticated />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('waitlist-form')).not.toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/dashboard')
  })
})
