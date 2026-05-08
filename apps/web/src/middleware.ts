import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { updateSession } from '@kiyo/supabase'

import { defaultLocale, locales } from './i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // 因为核心页面（songs/albums/lyrics/login 等）放在 app/ 根目录下，
  // 不在 app/[locale]/ 下，next-intl 不会自动 rewrite /en/* 到 /*。
  // 这里手动处理 /en/* 和 /zh/* 子路径的 rewrite，避免 404。
  const localePathMatch = pathname.match(/^\/(en|zh)\/(.+)$/)
  if (localePathMatch) {
    const url = request.nextUrl.clone()
    url.pathname = '/' + localePathMatch[2]
    const response = NextResponse.rewrite(url)
    response.headers.set('X-NEXT-INTL-LOCALE', localePathMatch[1])
    return await updateSession(request, response)
  }

  // 其他路径（如 /songs、/en、/zh）由 next-intl 处理
  const intlResponse = intlMiddleware(request)
  return await updateSession(request, intlResponse)
}

export const config = {
  // 匹配除 API、auth callback、Next 静态资源、图片资源以外的所有路径
  matcher: [
    '/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
