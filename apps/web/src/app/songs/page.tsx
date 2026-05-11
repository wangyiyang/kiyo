'use client'

import { useEffect, useState, useCallback } from 'react'
import { EmptyState, SongCard } from '@kiyo/ui'
import { Link } from '@/i18n/navigation'
import { Plus, Wand2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  duration: number | null
  lyrics?: { title: string; id: string } | null
  cover_url: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function SongsPage() {
  const locale = useLocale()
  const t = useTranslations('songs')
  const tCommon = useTranslations('common')

  const [songs, setSongs] = useState<Song[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)

  const page = pagination.page

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/songs?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setSongs(data.songs ?? [])
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setSongs([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  const statusLabelMap: Record<string, string> = {
    draft: tCommon('states.loading'),
    generating: tCommon('states.generating'),
    completed: t('detail.source.manual'),
    failed: tCommon('errors.unknown'),
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/songs/generate"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">{tCommon('loading')}</div>
      ) : songs.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.map((song) => (
              <SongCard
                key={song.id}
                id={song.id}
                title={song.title}
                status={song.status}
                statusLabel={statusLabelMap[song.status] ?? song.status}
                duration={song.duration}
                lyricTitle={song.lyrics?.title ?? null}
                coverUrl={song.cover_url}
                href={`/songs/${song.id}`}
              />
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
        <EmptyState title={tCommon('empty.songs.title')} description={tCommon('empty.songs.description')} />
      )}
    </div>
  )
}
