'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  Separator,
} from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'

const navLinks = [
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const

export function MobileNavSheet() {
  const t = useTranslations('nav')
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('openMenu')}
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:w-80">
        <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
        <SheetDescription className="sr-only">{t('menu')}</SheetDescription>

        <nav className="mt-8 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-3 text-base text-foreground transition-colors hover:bg-accent"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <Separator className="my-6" />

        <div className="flex flex-col gap-3 px-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('language')}
            </span>
            <LocaleSwitcher />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('theme')}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
