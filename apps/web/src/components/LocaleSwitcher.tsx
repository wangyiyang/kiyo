'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kiyo/ui'
import { Button } from '@kiyo/ui'
import { Globe } from 'lucide-react'

const locales = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
] as const

export function LocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('localeSwitcher')

  const handleChange = (nextLocale: string) => {
    document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  const currentLabel = locales.find((l) => l.code === locale)?.label ?? locale

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="mr-2 h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => handleChange(l.code)}
            className={locale === l.code ? 'bg-accent' : ''}
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
