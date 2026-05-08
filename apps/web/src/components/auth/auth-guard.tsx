import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function AuthGuard({
  children,
  redirectTo = '/',
}: AuthGuardProps) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(redirectTo)
  }

  return <>{children}</>
}
