import { createServerClient as createServer } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'
import { getSupabaseClientConfig } from './env'

export async function createServerClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createServer(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // Server Component 中无法设置 cookie，忽略
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: '', ...options })
        } catch {
          // Server Component 中无法删除 cookie，忽略
        }
      },
    },
  })
}
