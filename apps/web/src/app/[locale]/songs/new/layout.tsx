import { redirect } from 'next/navigation'
import { createServerClient } from '@kiyo/supabase/server'

export default async function NewSongLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirectTo=/songs/new')
  }

  return <>{children}</>
}
