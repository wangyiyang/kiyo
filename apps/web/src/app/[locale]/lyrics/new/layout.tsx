import { RequireAuth } from '@/components/auth/require-auth'

export default async function NewLyricLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/lyrics/new">
      {children}
    </RequireAuth>
  )
}
