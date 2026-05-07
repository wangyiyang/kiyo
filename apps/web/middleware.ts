import createMiddleware from 'next-intl/middleware'
import { type NextRequest } from 'next/server'

import { updateSession } from '@kiyo/supabase'

import { defaultLocale, locales } from './src/i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  // 1) 先让 next-intl 决定 locale 路由（重定向 / 重写 / 透传）
  const intlResponse = intlMiddleware(request)

  // 2) 再让 Supabase 在该响应上挂 cookie，刷新 session
  return await updateSession(request, intlResponse)
}

export const config = {
  // 匹配除 API、Next 静态资源、图片资源以外的所有路径
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
