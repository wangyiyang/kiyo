import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LocaleSwitcher } from './LocaleSwitcher'

const mockReplace = vi.fn()

vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/settings',
}))

vi.mock('@kiyo/ui', async () => {
  const actual = await vi.importActual<typeof import('@kiyo/ui')>('@kiyo/ui')
  return {
    ...actual,
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
  }
})

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    mockReplace.mockClear()
  })

  it('calls router.replace with pathname and locale when a language is selected', () => {
    render(<LocaleSwitcher />)

    const englishButton = screen.getByRole('button', { name: /English/i })
    fireEvent.click(englishButton)

    expect(mockReplace).toHaveBeenCalledTimes(1)
    expect(mockReplace).toHaveBeenCalledWith('/settings', { locale: 'en' })
  })

  it('does not call router.replace when the current locale is selected', () => {
    render(<LocaleSwitcher />)

    const zhButtons = screen.getAllByRole('button', { name: /中文/i })
    // 第一个为 trigger button，第二个为 dropdown item
    fireEvent.click(zhButtons[1])

    expect(mockReplace).not.toHaveBeenCalled()
  })
})
