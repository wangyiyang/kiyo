import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import { Toaster } from '@kiyo/ui'

import { WaitlistDialog } from '@/components/waitlist-dialog'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

import { Providers } from '../providers'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const localeForMessages = hasLocale(locales, params.locale)
    ? params.locale
    : defaultLocale
  const t = await getTranslations({
    locale: localeForMessages,
    namespace: 'metadata',
  })

  const ogLocaleMap: Record<Locale, string> = {
    en: 'en_US',
    zh: 'zh_CN',
  }

  return {
    title: {
      default: t('title'),
      template: `%s · ${t('applicationName')}`,
    },
    description: t('description'),
    applicationName: t('applicationName'),
    openGraph: {
      type: 'website',
      title: t('title'),
      description: t('description'),
      siteName: t('applicationName'),
      locale: ogLocaleMap[localeForMessages as Locale] ?? 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    alternates: {
      canonical: `/${localeForMessages}`,
      languages: {
        en: '/en',
        zh: '/zh',
        'x-default': `/${defaultLocale}`,
      },
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  // 1) v4 守卫:locale 不在白名单 → 404
  if (!hasLocale(locales, params.locale)) {
    notFound()
  }

  // 2) 启用静态渲染 + 让 server components 拿到 request locale
  setRequestLocale(params.locale)

  // 3) 拉取当前 locale 对应的 messages
  const messages = await getMessages()

  return (
    <html
      lang={params.locale}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          <Providers>
            {children}
            <WaitlistDialog />
            <Toaster richColors closeButton position="top-center" />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
