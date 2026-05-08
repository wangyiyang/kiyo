'use client'

import * as React from 'react'
import Link from 'next/link'
import { Music2 } from 'lucide-react'

import { cn } from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './auth/user-menu'
import { createBrowserClient } from '@kiyo/supabase'

const navLinks = [
  { href: '/songs', key: 'songs', label: '歌曲库' },
  { href: '/albums', key: 'albums', label: '专辑' },
  { href: '/lyrics', key: 'lyrics', label: '歌词' },
] as const

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false)
  const [user, setUser] = React.useState<{ email: string } | null>(null)

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    const supabase = createBrowserClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUser({ email: user.email })
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          setUser({ email: session.user.email })
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
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
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
