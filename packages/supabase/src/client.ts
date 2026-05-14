import { createBrowserClient as createBrowser } from '@supabase/ssr'
import { parse, serialize } from 'cookie'
import { getSupabaseClientConfig } from './env'
import type { Database } from './database.types'

export function createBrowserClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createBrowser<Database>(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        const parsed = parse(document.cookie)
        return Object.keys(parsed).map((name) => ({
          name,
          value: parsed[name] ?? '',
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serialize(name, value, options)
        })
      },
    },
  })
}
