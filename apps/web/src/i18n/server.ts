import { headers } from 'next/headers'
import { defaultLocale } from './config'

export async function getLocale(): Promise<string> {
  const h = await headers()
  return h.get('X-NEXT-INTL-LOCALE') || defaultLocale
}

export async function withLocale(href: string): Promise<string> {
  if (!href.startsWith('/') || href.startsWith('/api')) return href
  const locale = await getLocale()
  if (href.startsWith(`/${locale}/`)) return href
  return `/${locale}${href}`
}
