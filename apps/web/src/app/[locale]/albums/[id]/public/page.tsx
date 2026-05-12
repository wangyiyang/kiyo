import { Metadata } from 'next'
import Image from 'next/image'
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button } from '@kiyo/ui'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'

interface AlbumPublicPageProps {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: AlbumPublicPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: album } = await supabase
    .from('albums')
    .select('title, description, cover_url, cover_file_path')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!album) {
    return { title: 'Not Found' }
  }

  const title = `${album.title} - Kiyo`
  const description = [album.description, 'Created with Kiyo'].filter(Boolean).join(' · ')
  const image = album.cover_url || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: 'music.album',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function AlbumPublicPage({ params }: AlbumPublicPageProps) {
  const { locale, id } = await params
  const supabase = await createServerClient()
  const t = await getTranslations('share')
  const tCommon = await getTranslations('common')

  const { data: { user } } = await supabase.auth.getUser()

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
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
  const playableSongs = songs.filter((s: any) => s.status === 'completed' && (s.audio_url || s.file_path))

  const formatDuration = (seconds?: number | null) => {
    if (seconds == null) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <main className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tCommon('actions.back')}
        </Link>
      </div>

      {/* Cover */}
      <div className="mb-6">
        <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
          {album.cover_url ? (
            <Image
              src={album.cover_url}
              alt={album.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/10" />
          )}
        </div>
      </div>

      {/* Title & Description */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      {/* Album Player */}
      {playableSongs.length > 0 && (
        <div className="mb-6">
          {user ? (
            <AudioPlayer
              src={playableSongs[0]?.audio_url || ''}
              filePath={playableSongs[0]?.file_path}
              title={playableSongs[0]?.title}
              album={album.title}
              coverUrl={album.cover_url}
              coverFilePath={album.cover_file_path}
              songId={playableSongs[0]?.id}
              playlist={playableSongs.map((s: any) => ({
                id: s.id,
                title: s.title,
                audio_url: s.audio_url || '',
                file_path: s.file_path,
                cover_url: s.cover_url,
                duration: s.duration,
                album: album.title,
              }))}
              className="w-full"
            />
          ) : (
            <div className="relative rounded-lg border bg-muted/30 p-8">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{t('loginToPlay')}</p>
                <Button asChild size="sm">
                  <Link href={`/login?redirect=/albums/${id}/public`}>{t('loginToPlay')}</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Song List */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">{tCommon('albums.detail.songList')}</h2>
        <div className="divide-y rounded-lg border">
          {songs.map((song: any, index: number) => (
            <div key={song.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
                <span className="font-medium">{song.title}</span>
              </div>
              <span className="text-sm text-muted-foreground">{formatDuration(song.duration)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/explore">{t('playOnKiyo')}</Link>
        </Button>
      </div>
    </main>
  )
}
