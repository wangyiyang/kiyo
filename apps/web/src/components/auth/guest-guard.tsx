import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

interface GuestGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function GuestGuard({
  children,
  redirectTo = '/',
}: GuestGuardProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(redirectTo)
  }

  return <>{children}</>
}
