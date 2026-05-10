'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'

import { Button } from '@kiyo/ui'

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const t = useTranslations('common')

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const current = theme === 'system' ? resolvedTheme : theme
  const next = current === 'dark' ? 'light' : 'dark'
  const ariaLabel = next === 'dark' ? t('themeToggle.toDark') : t('themeToggle.toLight')

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('themeToggle.switch')}
        className="opacity-0"
      >
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={ariaLabel}
      onClick={() => setTheme(next)}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
