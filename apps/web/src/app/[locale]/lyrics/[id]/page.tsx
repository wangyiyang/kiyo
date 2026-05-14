import { createServerClient } from '@kiyo/supabase/server'
import { Link } from '@/i18n/navigation'
import { StructuredBlockViewer, textToBlocks, Button, SongStatusBadge } from '@kiyo/ui'
import { Pencil, ArrowLeft } from 'lucide-react'
import { notFound, redirect } from 'next/navigation'
import { GenerateSongDialog } from './generate-song-dialog'
import { getTranslations } from 'next-intl/server'

export default async function LyricDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: lyric } = await supabase
    .from('lyrics')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!lyric) {
    notFound()
  }

  const { data: linkedSongs } = await supabase
    .from('songs')
    .select('id, title, status, genre, mood, created_at')
    .eq('lyric_id', params.id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const blocks = textToBlocks(lyric.content)
  const t = await getTranslations('lyrics.detail')
  const tCommon = await getTranslations('common')

  const sourceLabel = lyric.source === 'ai_generated' ? t('source.ai') : t('source.manual')

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
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{lyric.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                lyric.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {sourceLabel}
            </span>
            {lyric.language && <span>{lyric.language}</span>}
            {lyric.style && <span>{lyric.style}</span>}
            {lyric.mood && <span>{lyric.mood}</span>}
          </div>
        </div>
        <GenerateSongDialog
          lyricId={lyric.id}
          lyricTitle={lyric.title}
          lyricContent={lyric.content}
          lyricLanguage={lyric.language}
        />
        <Link href={`/lyrics/${lyric.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            {t('edit')}
          </Button>
        </Link>
      </div>

      <StructuredBlockViewer blocks={blocks} />

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">{t('linkedSongs')}</h2>
        {linkedSongs && linkedSongs.length > 0 ? (
          <div className="space-y-3">
            {linkedSongs.map((song) => (
              <Link key={song.id} href={`/songs/${song.id}`}>
                <div className="flex items-center justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{song.title}</span>
                    <SongStatusBadge status={song.status as any} label={statusLabelMap[song.status] ?? song.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {song.genre && <span>{song.genre}</span>}
                    {song.mood && <span>{song.mood}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">{t('noLinkedSongs.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('noLinkedSongs.description')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
