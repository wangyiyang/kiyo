import { createServerClient } from '@kiyo/supabase/server'
import { Link } from '@/i18n/navigation'
import { redirect } from 'next/navigation'
import { EmptyState } from '@kiyo/ui'
import { Plus, Sparkles } from 'lucide-react'
import { getLocale } from '@/i18n/server'
import { getTranslations } from 'next-intl/server'

export default async function LyricsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const locale = await getLocale()
    redirect(`/${locale}/login`)
  }

  const { data: lyrics } = await supabase
    .from('lyrics')
    .select('*, songs(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const locale = await getLocale()
  const t = await getTranslations('lyrics')
  const tCommon = await getTranslations('common')

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex gap-3">
          <Link
            href={`/${locale}/lyrics/generate`}
            className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Sparkles className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href={`/${locale}/lyrics/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {lyrics && lyrics.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lyrics.map((lyric) => (
            <Link key={lyric.id} href={`/${locale}/lyrics/${lyric.id}`}>
              <div className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-semibold">{lyric.title}</h3>
                  {lyric.songs?.[0]?.count > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">
                      🎵 {t('detail.composed')}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      lyric.source === 'ai_generated'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {lyric.source === 'ai_generated' ? t('detail.source.ai') : t('detail.source.manual')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {lyric.content.length > 100 ? lyric.content.slice(0, 100) + '...' : lyric.content}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{lyric.language ?? t('detail.noLanguage')}</span>
                  <span>{lyric.style ?? t('detail.noStyle')}</span>
                  <span className="ml-auto">
                    {new Date(lyric.created_at).toLocaleDateString(locale)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={tCommon('empty.lyrics.title')} description={tCommon('empty.lyrics.description')} />
      )}
    </div>
  )
}
