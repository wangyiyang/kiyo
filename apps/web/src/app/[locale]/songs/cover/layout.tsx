import { RequireAuth } from '@/components/auth/require-auth'

export default async function CoverSongLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
