import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'

import { WaitlistDialog } from '@/components/waitlist-dialog'
import { FeedbackDialog } from '@/components/feedback-dialog'
import { GlobalPlayer } from '@/components/global-player'
import { defaultLocale, locales, type Locale } from '@/i18n/config'

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
    <NextIntlClientProvider locale={params.locale} messages={messages}>
      {children}
      <GlobalPlayer />
      <WaitlistDialog />
      <FeedbackDialog />
    </NextIntlClientProvider>
  )
}
