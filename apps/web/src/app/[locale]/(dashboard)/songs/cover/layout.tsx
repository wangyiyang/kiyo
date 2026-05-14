import { RequireAuth } from '@/components/auth/require-auth'

export default async function CoverSongLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth redirectTo="/login?redirectTo=/songs/cover">{children}</RequireAuth>
}
