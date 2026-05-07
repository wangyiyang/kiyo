'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'

import { WaitlistProvider } from '@/lib/waitlist-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WaitlistProvider>{children}</WaitlistProvider>
    </ThemeProvider>
  )
}
