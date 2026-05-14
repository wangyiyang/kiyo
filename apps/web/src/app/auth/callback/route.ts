import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@kiyo/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    console.error('[OAuth Callback] Missing authorization code')
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[OAuth Callback] Exchange failed:', error.message)
    return NextResponse.redirect(`${origin}/login?error=oauth_exchange_failed`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
