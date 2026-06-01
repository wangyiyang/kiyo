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
import { ShareButton } from '@/components/share-button'
import { RequireAuth } from '@/components/auth/require-auth'

/**
 * 原始歌曲类型（用于 AI 翻唱对比播放器）
 * 只包含展示所需字段，不包含完整歌曲表结构
 */
interface OriginalSong {
  id: string
  title: string
  audio_url: string | null
  file_path: string | null
  duration: number | null
  cover_url: string | null
  cover_file_path: string | null
}

interface OriginalSongPlayerProps {
  originalSong: OriginalSong
  tPlayer: (key: string) => string
  t: (key: string) => string
}

const PLAYER_LABELS = ['play', 'pause', 'playlist', 'prev', 'next', 'shuffle', 'repeat', 'repeatOne', 'mute', 'unmute', 'volume', 'empty', 'playSong', 'playingIndicator'] as const

function OriginalSongPlayer({ originalSong, tPlayer, t }: OriginalSongPlayerProps) {
  const labels = Object.fromEntries(
    PLAYER_LABELS.map((key) => [key, tPlayer(key)])
  ) as Record<(typeof PLAYER_LABELS)[number], string>

  return (
    <AudioPlayer
      src={originalSong.audio_url || ''}
      filePath={originalSong.file_path}
      title={originalSong.title || t('original')}
      duration={originalSong.duration}
      coverUrl={originalSong.cover_url}
      coverFilePath={originalSong.cover_file_path}
      songId={originalSong.id}
      className="w-full"
      labels={labels}
    />
  )
}

export default async function SongDetailPage({
  params,
}: {
  params: { locale: string; id: string }
}) {
  const { locale, id } = params
  return (
    <RequireAuth redirectTo={`/login?redirectTo=/songs/${id}`}>
      <SongDetailContent locale={locale} id={id} />
    </RequireAuth>
  )
}

async function SongDetailContent({ locale, id }: { locale: string; id: string }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: song } = await supabase
    .from('songs')
    .select('*, cover_file_path, file_path, lyrics(*), original_song:original_song_id(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!song) {
    notFound()
  }

  const t = await getTranslations('songs.detail')
  const tCommon = await getTranslations('common')
  const tPlayer = await getTranslations('player')

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
    <div className="container mx-auto max-w-3xl px-4 py-8">
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

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold leading-tight">{song.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SongStatusBadge
              status={song.status as 'draft' | 'generating' | 'completed' | 'failed'}
              label={statusLabelMap[song.status] ?? song.status}
            />
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {song.status === 'completed' && (song.audio_url || song.file_path) && (
            <>
              <ExportDialog songId={song.id} songTitle={song.title} />
              <Button variant="outline" size="sm" disabled>
                <Mic2 className="mr-1 h-4 w-4" />
                {t('aiCover')}
              </Button>
            </>
          )}
          <ShareButton
            entityType="song"
            entityId={song.id}
            title={song.title}
            isPublic={song.is_public ?? false}
            locale={locale}
          />
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
      )}

      {song.source === 'ai_cover' && song.voice_style && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">{t('coverStyle')}</h2>
          <p className="text-sm text-muted-foreground">{song.voice_style}</p>
        </div>
      )}

      {song.source === 'ai_cover' && song.original_song_id && song.original_song && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">{t('compareOriginal')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t('original')}</p>
              <OriginalSongPlayer
                originalSong={song.original_song}
                tPlayer={tPlayer}
                t={t}
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
            <Link
              href={`/lyrics/${song.lyrics.id}`}
              className="text-xs text-primary hover:underline"
            >
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