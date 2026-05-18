import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, type Locale } from './config'

const COOKIE_NAME = 'NEXT_LOCALE'

export async function getLocale(): Promise<string> {
  // 1. Check cookie first
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(COOKIE_NAME)?.value
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale
  }

  // 2. Fall back to Accept-Language header
  const h = await headers()
  const acceptLang = h.get('accept-language')
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0]?.split('-')[0]
    if (preferred && locales.includes(preferred as Locale)) {
      return preferred
    }
  }

  // 3. Default
  return defaultLocale
}

export async function withLocale(href: string): Promise<string> {
  // No locale prefix in URLs anymore
  return href
}
