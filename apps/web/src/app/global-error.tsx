'use client'

import './globals.css'

import { useEffect } from 'react'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'global-error' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <ErrorBoundaryPage error={error} reset={reset} homeHref="/" />
      </body>
    </html>
  )
}