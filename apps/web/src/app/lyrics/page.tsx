'use client'

import { useEffect, useState, useCallback } from 'react'
import { Link } from '@/i18n/navigation'
import { EmptyState } from '@kiyo/ui'
import { Plus, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

interface Lyric {
  id: string
  title: string
  content: string
  language: string | null
  style: string | null
  source: string
  created_at: string
  songs?: { count: number }[] | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function LyricsPage() {
  const locale = useLocale()
  const t = useTranslations('lyrics')
  const tCommon = useTranslations('common')

  const [lyrics, setLyrics] = useState<Lyric[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  const page = pagination.page

  const fetchLyrics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lyrics?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setLyrics(data.lyrics ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setLyrics([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchLyrics()
  }, [fetchLyrics])

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

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

      {loading ? (
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      ) : lyrics.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lyrics.map((lyric) => (
              <Link key={lyric.id} href={`/${locale}/lyrics/${lyric.id}`}>
                <div className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="font-semibold">{lyric.title}</h3>
                    {(lyric.songs?.[0]?.count ?? 0) > 0 && (
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
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= pagination.totalPages}
                className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyState title={tCommon('empty.lyrics.title')} description={tCommon('empty.lyrics.description')} />
      )}
    </div>
  )
}
