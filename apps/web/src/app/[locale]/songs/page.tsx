import { RequireAuth } from '@/components/auth/require-auth'
import SongsList from './songs-list'

export default async function SongsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/songs">
      <SongsList />
    </RequireAuth>
  )
}
