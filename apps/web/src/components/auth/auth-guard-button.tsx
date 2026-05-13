'use client'

import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import { createBrowserClient } from '@kiyo/supabase'

interface AuthGuardButtonProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function AuthGuardButton({ href, children, className }: AuthGuardButtonProps) {
  const router = useRouter()

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const supabase = createBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push(`/login?redirectTo=${encodeURIComponent(href)}`)
      return
    }
    router.push(href)
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  )
}
