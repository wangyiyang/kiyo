import { RequireAuth } from '@/components/auth/require-auth'

export default async function LyricEditLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <RequireAuth>{children}</RequireAuth>
}
