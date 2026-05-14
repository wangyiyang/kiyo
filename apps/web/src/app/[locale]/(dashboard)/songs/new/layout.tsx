import { RequireAuth } from '@/components/auth/require-auth'

export default async function NewSongLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/songs/new">
      {children}
    </RequireAuth>
  )
}
