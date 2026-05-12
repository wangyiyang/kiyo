import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, EmptyState } from '@kiyo/ui'
import { notFound, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { DraggableSongList } from '../_components/DraggableSongList'
import { CoverSection } from '@/components/CoverSection'
import { AddSongsDialog } from './_components/AddSongsDialog'
import { ShareButton } from '@/components/share-button'
import { getTranslations } from 'next-intl/server'

interface AlbumDetailPageProps {
  params: Promise<{ locale: string; id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { locale, id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: album } = await supabase
    .from('albums')
    .select('*, cover_file_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(id, title, audio_url, file_path, cover_url, cover_file_path, duration)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs).filter(Boolean)

  const t = await getTranslations('albums')
  const tCommon = await getTranslations('common')
  const tPlayer = await getTranslations('player')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/albums" className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('detail.back')}
        </Link>
      </div>

      <CoverSection
        entityId={id}
        entityType="album"
        coverUrl={album.cover_url}
        coverFilePath={album.cover_file_path}
        coverStatus={album.cover_status}
        title={album.title}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('detail.songList')}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t('detail.songCount', { count: songs.length })}</span>
          <ShareButton
            entityType="album"
            entityId={id}
            title={album.title}
            isPublic={album.is_public ?? false}
            locale={locale}
          />
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
      </div>

      {songs.length > 0 ? (
        <>
          <div className="mb-6">
            <AudioPlayer
              src={songs[0]?.audio_url || ''}
              filePath={songs[0]?.file_path}
              title={songs[0]?.title}
              album={album.title}
              coverUrl={album.cover_url}
              coverFilePath={album.cover_file_path}
              songId={songs[0]?.id}
              playlist={songs.map((s: any) => ({
                id: s.id,
                title: s.title,
                audio_url: s.audio_url || '',
                file_path: s.file_path,
                cover_url: s.cover_url,
                duration: s.duration,
                album: album.title,
              }))}
              className="w-full"
              labels={{
                play: tPlayer('play'),
                pause: tPlayer('pause'),
                playlist: tPlayer('playlist'),
                prev: tPlayer('prev'),
                next: tPlayer('next'),
                shuffle: tPlayer('shuffle'),
                repeat: tPlayer('repeat'),
                repeatOne: tPlayer('repeatOne'),
                mute: tPlayer('mute'),
                unmute: tPlayer('unmute'),
                volume: tPlayer('volume'),
                empty: tPlayer('empty'),
                playSong: tPlayer('playSong'),
                playingIndicator: tPlayer('playingIndicator'),
              }}
            />
          </div>
          <DraggableSongList
            songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
            albumId={id}
          />
        </>
      ) : (
        <EmptyState title={t('detail.noSongs.title')} description={t('detail.noSongs.description')} />
      )}
    </div>
  )
}
