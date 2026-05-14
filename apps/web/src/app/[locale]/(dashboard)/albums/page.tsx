import { RequireAuth } from '@/components/auth/require-auth'
import AlbumsList from './albums-list'

export default async function AlbumsPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/albums">
      <AlbumsList />
    </RequireAuth>
  )
}
