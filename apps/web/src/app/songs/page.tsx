import { createServerClient } from '@kiyo/supabase/server'
import { EmptyState, SongCard } from '@kiyo/ui'
import { Link } from '@/i18n/navigation'
import { redirect } from 'next/navigation'
import { Plus, Wand2 } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getTranslations } from 'next-intl/server'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/login`)
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const locale = await getLocale()
  const t = await getTranslations('songs')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/songs/generate`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href={`/${locale}/songs/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {songs && songs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              id={song.id}
              title={song.title}
              status={song.status}
              duration={song.duration}
              lyricTitle={song.lyrics?.title ?? null}
              coverUrl={song.cover_url}
              href={`/${locale}/songs/${song.id}`}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.songs.title')} description={tCommon('empty.songs.description')} />
      )}
    </div>
  )
}
