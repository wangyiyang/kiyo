'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

import { ErrorBoundaryPage } from '@/components/error-boundary-page'
import { captureAppException } from '@/lib/monitoring'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function LocaleErrorPage({ error, reset }: ErrorPageProps) {
  const params = useParams<{ locale?: string }>()
  const locale: Locale = isSupportedLocale(params.locale)
    ? params.locale
    : defaultLocale

  useEffect(() => {
    captureAppException(error, {
      tags: { boundary: 'locale-error', locale },
      extra: { digest: error.digest },
    })
  }, [error, locale])

  return <ErrorBoundaryPage error={error} reset={reset} homeHref={`/${locale}`} />
}

function isSupportedLocale(locale: string | undefined): locale is Locale {
  return locales.some((supportedLocale) => supportedLocale === locale)
}