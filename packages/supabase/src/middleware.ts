import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseClientConfig } from './env'

/**
 * 刷新 Supabase session。可选地把 cookie 写入上游 response（例如 next-intl
 * 返回的 redirect/rewrite 响应），从而与其它 middleware 链式组合。
 *
 * 如果环境变量缺失（如本地未配置 .env.local），优雅降级为透传 response。
 */
export async function updateSession(
  request: NextRequest,
  upstream?: NextResponse,
): Promise<NextResponse> {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  const response =
    upstream ?? NextResponse.next({ request: { headers: request.headers } })

  if (!supabaseUrl || !supabasePublishableKey) {
    return response
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getSession()

  return response
}
