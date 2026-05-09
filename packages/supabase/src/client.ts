import { createBrowserClient as createBrowser } from '@supabase/ssr'
import { getSupabaseClientConfig } from './env'

export function createBrowserClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseClientConfig()

  return createBrowser(supabaseUrl!, supabasePublishableKey!)
}
