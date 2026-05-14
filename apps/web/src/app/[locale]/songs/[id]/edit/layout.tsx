import { RequireAuth } from '@/components/auth/require-auth'

export default async function SongEditLayout({
  params,
  children,
}: {
  params: { id: string }
  children: React.ReactNode
}) {
  return <RequireAuth redirectTo={`/login?redirectTo=/songs/${params.id}/edit`}>{children}</RequireAuth>
}
