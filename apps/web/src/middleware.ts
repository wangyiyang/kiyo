import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'

import { updateSession } from '@kiyo/supabase'

import { defaultLocale, locales } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
})

export async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request)
  return await updateSession(request, intlResponse)
}

export const config = {
  // 匹配除 API、auth callback、Next 静态资源、图片资源以外的所有路径
  matcher: [
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
