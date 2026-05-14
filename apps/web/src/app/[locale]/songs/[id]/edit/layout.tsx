import { RequireAuth } from '@/components/auth/require-auth'

export default async function SongEditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
