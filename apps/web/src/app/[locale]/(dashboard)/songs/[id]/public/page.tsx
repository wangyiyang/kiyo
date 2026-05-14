import { Metadata } from 'next'
import Image from 'next/image'
import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button } from '@kiyo/ui'
import { notFound } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Play, ArrowLeft } from 'lucide-react'

interface SongPublicPageProps {
  params: Promise<{ locale: string; id: string }>
}

export async function generateMetadata({ params }: SongPublicPageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: song } = await supabase
    .from('songs')
    .select('title, genre, mood, cover_url, cover_file_path')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!song) {
    return { title: 'Not Found' }
  }

  const title = `${song.title} - Kiyo`
  const description = [song.genre, song.mood, 'Created with Kiyo'].filter(Boolean).join(' · ')
  const image = song.cover_url || undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : undefined,
      type: 'music.song',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  }
}

export default async function SongPublicPage({ params }: SongPublicPageProps) {
  const { locale, id } = await params
  const supabase = await createServerClient()
  const t = await getTranslations('share')
  const tCommon = await getTranslations('common')
  const tPlayer = await getTranslations('player')

  const { data: { user } } = await supabase.auth.getUser()

  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', id)
    .eq('is_public', true)
    .single()

  if (!song) {
    notFound()
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <main className="container mx-auto max-w-3xl py-8">
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
          {song.cover_url ? (
            <Image
              src={song.cover_url}
              alt={song.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-primary/10" />
          )}
        </div>
      </div>

      {/* Title & Meta */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{song.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {song.genre && <span>{song.genre}</span>}
          {song.mood && <span>{song.mood}</span>}
          {song.duration && (
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" aria-hidden="true" />
              {formatDuration(song.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Audio */}
      {song.status === 'completed' && (song.audio_url || song.file_path) && (
        <div className="mb-6">
          {user ? (
            <AudioPlayer
              src={song.audio_url || ''}
              filePath={song.file_path}
              title={song.title}
              duration={song.duration}
              coverUrl={song.cover_url}
              coverFilePath={song.cover_file_path}
              songId={song.id}
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
          ) : (
            <div className="relative rounded-lg border bg-muted/30 p-8">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{t('loginToPlay')}</p>
                <Button asChild size="sm">
                  <Link href={`/login?redirect=/songs/${id}/public`}>{t('loginToPlay')}</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lyrics */}
      {song.lyrics && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{tCommon('songs.detail.lyrics')}</h2>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/explore">{t('playOnKiyo')}</Link>
        </Button>
      </div>
    </main>
  )
}
