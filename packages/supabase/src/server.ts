import { createServerClient as createServer } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { type CookieOptions } from '@supabase/ssr'
import { getSupabaseClientConfig } from './env'
import type { Database } from './database.types'

export async function createServerClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createServer<Database>(supabaseUrl!, supabasePublishableKey!, {
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

export function createServiceRoleClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseClientConfig()
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient<Database>(supabaseUrl!, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
