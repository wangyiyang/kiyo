import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

interface RequireAuthProps {
  children: React.ReactNode
  redirectTo?: string
}

export async function RequireAuth({ children, redirectTo = '/login' }: RequireAuthProps) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(redirectTo)
  }

  return <>{children}</>
}
