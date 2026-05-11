'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'

import { WaitlistProvider } from '@/lib/waitlist-context'
import { FeedbackProvider } from '@/lib/feedback-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WaitlistProvider>
        <FeedbackProvider>{children}</FeedbackProvider>
      </WaitlistProvider>
    </ThemeProvider>
  )
}
