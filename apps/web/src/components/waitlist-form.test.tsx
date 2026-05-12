import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { WaitlistForm } from './waitlist-form'
import { joinWaitlist } from '@/app/actions/waitlist'

const mockJoinWaitlist = vi.mocked(joinWaitlist)

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const dict: Record<string, string> = {
      'fields.email.label': 'Email',
      'fields.email.placeholder': 'you@example.com',
      'fields.role.label': 'Role',
      'fields.role.options.beginner': 'Beginner',
      'fields.role.options.enthusiast': 'Enthusiast',
      'fields.role.options.indie': 'Indie',
      'fields.role.options.professional': 'Professional',
      'fields.role.options.songwriter': 'Songwriter',
      'fields.role.options.other': 'Other',
      'fields.interests.label': 'Interests',
      'fields.interests.options.composition': 'Composition',
      'fields.interests.options.arrangement': 'Arrangement',
      'fields.interests.options.vocal': 'Vocal',
      'fields.interests.options.mixing': 'Mixing',
      'fields.interests.options.cover': 'Cover',
      'fields.interests.options.lyrics': 'Lyrics',
      'fields.useScenes.label': 'Scenes',
      'fields.useScenes.options.personal': 'Personal',
      'fields.useScenes.options.commercial': 'Commercial',
      'fields.useScenes.options.education': 'Education',
      'fields.useScenes.options.social': 'Social',
      'inline.expand': 'Expand',
      'inline.collapse': 'Collapse',
      'actions.submit': 'Submit',
      'actions.submitting': 'Submitting…',
      'toast.success.title': 'Success',
      'toast.success.description': 'You are on the list',
      'toast.duplicate': 'Duplicate',
      'toast.invalid': 'Invalid',
      'toast.unknown': 'Unknown',
    }
    return dict[key] ?? key
  },
}))

vi.mock('@/app/actions/waitlist', () => ({
  joinWaitlist: vi.fn(),
}))

describe('WaitlistForm', () => {
  it('renders email field in simple mode', () => {
    render(<WaitlistForm mode="simple" />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByText('Role')).toBeInTheDocument()
    // simple 模式下没有折叠按钮
    expect(screen.queryByText('Expand')).not.toBeInTheDocument()
  })

  it('renders only email + expand button in full collapsible mode', () => {
    render(<WaitlistForm mode="full" collapsible />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByText('Expand')).toBeInTheDocument()
    expect(screen.queryByText('Role')).not.toBeInTheDocument()
    expect(screen.queryByText('Interests')).not.toBeInTheDocument()
  })

  it('expands to show all fields and collapses back', () => {
    render(<WaitlistForm mode="full" collapsible />)
    fireEvent.click(screen.getByText('Expand'))
    expect(screen.getByText('Role')).toBeInTheDocument()
    expect(screen.getByText('Interests')).toBeInTheDocument()
    expect(screen.getByText('Scenes')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Collapse'))
    expect(screen.queryByText('Role')).not.toBeInTheDocument()
    expect(screen.queryByText('Interests')).not.toBeInTheDocument()
  })

  it('allows role selection and deselection', () => {
    render(<WaitlistForm mode="simple" />)
    const beginnerBtn = screen.getByText('Beginner')
    fireEvent.click(beginnerBtn)
    expect(beginnerBtn).toHaveClass('border-primary')

    // 切换到另一个角色
    const indieBtn = screen.getByText('Indie')
    fireEvent.click(indieBtn)
    expect(indieBtn).toHaveClass('border-primary')
    expect(beginnerBtn).not.toHaveClass('border-primary')

    // 取消选择
    fireEvent.click(indieBtn)
    expect(indieBtn).not.toHaveClass('border-primary')
  })

  it('allows interest multi-selection', () => {
    render(<WaitlistForm mode="full" />)
    const composition = screen.getByLabelText('Composition')
    const cover = screen.getByLabelText('Cover')

    fireEvent.click(composition)
    fireEvent.click(cover)

    expect(composition).toBeChecked()
    expect(cover).toBeChecked()

    // 取消选择
    fireEvent.click(composition)
    expect(composition).not.toBeChecked()
    expect(cover).toBeChecked()
  })

  it('submits form with correct values', async () => {
    mockJoinWaitlist.mockResolvedValue({ ok: true })
    const onSuccess = vi.fn()

    render(<WaitlistForm mode="simple" onSuccess={onSuccess} />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByText('Beginner'))
    fireEvent.click(screen.getByText('Submit'))

    await waitFor(() => {
      expect(mockJoinWaitlist).toHaveBeenCalledWith({
        email: 'test@example.com',
        role: 'beginner',
        interests: [],
        useScenes: [],
      })
      expect(onSuccess).toHaveBeenCalled()
    })
  })
})
