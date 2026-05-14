import { RequireAuth } from '@/components/auth/require-auth'
import LyricsList from './lyrics-list'

export default async function LyricsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/lyrics">
      <LyricsList />
    </RequireAuth>
  )
}
