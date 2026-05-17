'use client'

import * as React from 'react'
import { Link } from '@/i18n/navigation'
import { Music2 } from 'lucide-react'

import { cn } from '@kiyo/ui'

import { LocaleSwitcher } from './LocaleSwitcher'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './auth/user-menu'
import { NotificationBell } from './notifications/notification-bell'
import { createBrowserClient } from '@kiyo/supabase'
import { useTranslations } from 'next-intl'
import { MobileNavSheet } from './mobile-nav-sheet'

const navLinks = [
  { href: '/explore', key: 'explore' },
  { href: '/songs', key: 'songs' },
  { href: '/albums', key: 'albums' },
  { href: '/lyrics', key: 'lyrics' },
] as const

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false)
  const [user, setUser] = React.useState<{ email: string } | null>(null)
  const [userId, setUserId] = React.useState<string | undefined>(undefined)
  const [activeMenu, setActiveMenu] = React.useState<'notifications' | 'user' | null>(null)
  const t = useTranslations('nav')

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
        setUserId(user.id)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email) {
          setUser({ email: session.user.email })
          setUserId(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserId(undefined)
          setActiveMenu(null)
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
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <NotificationBell
            userId={userId}
            open={activeMenu === 'notifications'}
            onOpenChange={(open) => {
              setActiveMenu((current) =>
                open ? 'notifications' : current === 'notifications' ? null : current
              )
            }}
          />
          <UserMenu
            user={user}
            open={activeMenu === 'user'}
            onOpenChange={(open) => {
              setActiveMenu((current) =>
                open ? 'user' : current === 'user' ? null : current
              )
            }}
          />
          <MobileNavSheet />
        </div>
      </div>
    </header>
  )
}
