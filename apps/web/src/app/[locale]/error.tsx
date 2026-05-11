'use client'

import { useEffect } from 'react'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'
import { defaultLocale } from '@/i18n/config'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'app-error', locale: defaultLocale },
      extra: { digest: error.digest },
    })
  }, [error])

  return <ErrorBoundaryPage error={error} reset={reset} homeHref="/" />
}
