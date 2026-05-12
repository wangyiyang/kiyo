import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

export default async function NewLyricLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/lyrics/new')
  }

  return <>{children}</>
}
