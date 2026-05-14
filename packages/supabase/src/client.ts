import { createBrowserClient as createBrowser } from '@supabase/ssr'
import { getSupabaseClientConfig } from './env'
import type { Database } from './database.types'

export function createBrowserClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createBrowser<Database>(supabaseUrl!, supabasePublishableKey!)
}
