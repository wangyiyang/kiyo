'use client'

import { useEffect, useState, useCallback } from 'react'
import { EmptyState, SongCard, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@kiyo/ui'
import { Link, useRouter } from '@/i18n/navigation'
import { Wand2, Mic2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  duration: number | null
  lyrics?: { title: string; id: string } | null
  cover_url: string | null
  cover_file_path: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function SongsPage() {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('songs')
  const tCommon = useTranslations('common')

  const [songs, setSongs] = useState<Song[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; song: Song | null }>({ open: false, song: null })
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!deleteDialog.song) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/songs/${deleteDialog.song.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteDialog({ open: false, song: null })
        fetchSongs()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      alert(tCommon('errors.unknown'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Wand2 className="h-4 w-4" />
            {t('list.generate')}
          </Link>
          <Link
            href="/songs/cover"
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            <Mic2 className="h-4 w-4" />
            {t('list.cover')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">{tCommon('states.loading')}</div>
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
                coverFilePath={song.cover_file_path}
                href={`/songs/${song.id}`}
                onDelete={(id) => setDeleteDialog({ open: true, song: songs.find((s) => s.id === id) ?? null })}
                onCover={(id) => router.push(`/songs/cover?original_song_id=${id}`)}
              />
            ))}
          </div>

          <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, song: open ? deleteDialog.song : null })}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('detail.deleteConfirmTitle')}</DialogTitle>
                <DialogDescription>
                  {deleteDialog.song && t('detail.deleteConfirmDescription', { title: deleteDialog.song.title })}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteDialog({ open: false, song: null })} disabled={deleting}>
                  {tCommon('actions.cancel')}
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? tCommon('states.deleting') : t('detail.delete')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
