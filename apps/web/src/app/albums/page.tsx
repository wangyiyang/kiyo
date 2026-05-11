import { createServerClient } from '@kiyo/supabase/server'
import { EmptyState, AlbumCard } from '@kiyo/ui'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { AlbumFormDialog } from './_components/AlbumFormDialog'
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog'
import { Trash2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function AlbumsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: albums } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const albumIds = albums?.map((a) => a.id) ?? []
  let songCounts: Record<string, number> = {}

  if (albumIds.length > 0) {
    const { data: albumSongs } = await supabase
      .from('album_songs')
      .select('album_id')
      .in('album_id', albumIds)

    songCounts = (albumSongs ?? []).reduce((acc: Record<string, number>, curr: any) => {
      acc[curr.album_id] = (acc[curr.album_id] ?? 0) + 1
      return acc
    }, {})
  }

  const t = await getTranslations('albums')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex gap-4">
          <Link
            href="/songs"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t('list.songLibrary')}
          </Link>
          <AlbumFormDialog
            mode="create"
            trigger={
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                {t('list.new')}
              </button>
            }
          />
        </div>
      </div>

      {albums && albums.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <div key={album.id} className="relative group">
              <Link href={`/albums/${album.id}`}>
                <AlbumCard
                  title={album.title}
                  description={album.description}
                  songCount={songCounts[album.id] ?? 0}
                  coverUrl={album.cover_url}
                />
              </Link>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DeleteConfirmDialog
                  albumId={album.id}
                  albumTitle={album.title}
                  trigger={
                    <button className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  }
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.albums.title')} description={tCommon('empty.albums.description')} />
      )}
    </div>
  )
}
