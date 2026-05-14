import { RequireAuth } from '@/components/auth/require-auth'

export default async function LyricEditLayout({
  params,
  children,
}: {
  params: { id: string }
  children: React.ReactNode
}) {
  return <RequireAuth redirectTo={`/login?redirectTo=/lyrics/${params.id}/edit`}>{children}</RequireAuth>
}
