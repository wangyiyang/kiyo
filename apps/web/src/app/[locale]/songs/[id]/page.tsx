import { createServerClient } from '@kiyo/supabase/server'
import { AudioPlayer, Button, SongStatusBadge } from '@kiyo/ui'
import { ArrowLeft, Pencil, Play, Mic2 } from 'lucide-react'
import { GenerationPanel } from './generation-panel'
import { notFound, redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { ExportDialog } from './export-dialog'
import { CoverSection } from '@/components/CoverSection'
import { getTranslations } from 'next-intl/server'
import { DeleteButton } from './delete-button'

export default async function SongDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: song } = await supabase
    .from('songs')
    .select('*, cover_file_path, file_path, lyrics(*), original_song:original_song_id(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!song) {
    notFound()
  }

  const t = await getTranslations('songs.detail')
  const tCommon = await getTranslations('common')

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const sourceLabel =
    song.source === 'ai_generated'
      ? t('source.ai_generated')
      : song.source === 'ai_cover'
        ? t('source.ai_cover')
        : t('source.manual')

  const statusLabelMap: Record<string, string> = {
    draft: tCommon('states.loading'),
    generating: tCommon('states.generating'),
    completed: t('source.manual'),
    failed: tCommon('errors.unknown'),
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <CoverSection
        entityId={song.id}
        entityType="song"
        coverUrl={song.cover_url}
        coverFilePath={song.cover_file_path}
        coverStatus={song.cover_status ?? 'none'}
        title={song.title}
        genre={song.genre}
        mood={song.mood}
      />

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SongStatusBadge status={song.status} label={statusLabelMap[song.status] ?? song.status} />
            {song.genre && <span>{song.genre}</span>}
            {song.mood && <span>{song.mood}</span>}
            {song.duration && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {formatDuration(song.duration)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : song.source === 'ai_cover'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {sourceLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {song.status === 'completed' && (song.audio_url || song.file_path) && (
            <>
              <ExportDialog
                songId={song.id}
                songTitle={song.title}
              />
              <Link href={`/songs/cover?original_song_id=${song.id}`}>
                <Button variant="outline" size="sm">
                  <Mic2 className="mr-1 h-4 w-4" />
                  {t('aiCover')}
                </Button>
              </Link>
            </>
          )}
          <Link href={`/songs/${song.id}/edit`}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-1 h-4 w-4" />
              {t('edit')}
            </Button>
          </Link>
          <DeleteButton songId={song.id} songTitle={song.title} />
        </div>
      </div>

      <GenerationPanel songId={song.id} initialStatus={song.status} />

      {song.status === 'completed' && (song.audio_url || song.file_path) && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{t('audioPreview')}</h2>
          <AudioPlayer
            src={song.audio_url || ''}
            filePath={song.file_path}
            title={song.title}
            duration={song.duration}
            coverUrl={song.cover_url}
            coverFilePath={song.cover_file_path}
            songId={song.id}
            className="w-full"
          />
        </div>
      )}

      {song.source === 'ai_cover' && song.voice_style && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">{t('coverStyle')}</h2>
          <p className="text-sm text-muted-foreground">{song.voice_style}</p>
        </div>
      )}

      {song.source === 'ai_cover' && song.original_song_id && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{t('compareOriginal')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('original')}</p>
              <AudioPlayer
                src={(song.original_song as any)?.audio_url || ''}
                filePath={(song.original_song as any)?.file_path}
                title={(song.original_song as any)?.title || t('original')}
                duration={(song.original_song as any)?.duration}
                coverUrl={(song.original_song as any)?.cover_url}
                coverFilePath={(song.original_song as any)?.cover_file_path}
                songId={(song.original_song as any)?.id}
                className="w-full"
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('cover')}</p>
              <AudioPlayer
                src={song.audio_url || ''}
                filePath={song.file_path}
                title={song.title}
                duration={song.duration}
                coverUrl={song.cover_url}
                coverFilePath={song.cover_file_path}
                songId={song.id}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {song.ai_prompt && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">{t('aiPrompt')}</h2>
          <p className="text-sm text-muted-foreground">{song.ai_prompt}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">{t('lyrics')}</h2>
            <Link href={`/lyrics/${song.lyrics.id}`} className="text-xs text-primary hover:underline">
              {t('viewFullLyrics')}
            </Link>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
