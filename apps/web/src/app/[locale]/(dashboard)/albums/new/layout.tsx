import { RequireAuth } from '@/components/auth/require-auth'

export default async function NewAlbumLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/albums/new">
      {children}
    </RequireAuth>
  )
}