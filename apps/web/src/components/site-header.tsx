'use client'

import * as React from 'react'
import Link from 'next/link'
import { Music2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, cn } from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'
import { useWaitlist } from '@/lib/waitlist-context'

const navLinks = [
  { href: '#features', key: 'features' },
  { href: '#how', key: 'howItWorks' },
  { href: '#showcase', key: 'showcase' },
] as const

export function SiteHeader() {
  const t = useTranslations('header')
  const { show } = useWaitlist()
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-colors duration-300',
        scrolled
          ? 'border-b border-border/60 bg-background/80 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-semibold tracking-tight"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-kiyo-purple to-kiyo-cyan text-white shadow-[0_0_30px_-8px_hsl(var(--kiyo-purple)/0.7)]">
            <Music2 className="h-4 w-4" />
          </span>
          <span>Kiyo</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(`nav.${link.key}`)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button size="sm" onClick={show}>
            {t('cta')}
          </Button>
        </div>
      </div>
    </header>
  )
}
