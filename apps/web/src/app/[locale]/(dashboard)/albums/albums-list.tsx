'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { EmptyState, AlbumCard } from '@kiyo/ui'
import { Link } from '@/i18n/navigation'
import { DeleteConfirmDialog } from './_components/DeleteConfirmDialog'
import { Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Album {
  id: string
  title: string
  description: string | null
  cover_url: string | null
  cover_file_path: string | null
  created_at: string
  album_songs?: { count: number }[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AlbumsList() {
  const t = useTranslations('albums')
  const tCommon = useTranslations('common')

  const [albums, setAlbums] = useState<Album[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const page = pagination.page
  const refreshKeyRef = useRef(refreshKey)

  // Listen for album created events to refresh the list
  useEffect(() => {
    const handleAlbumCreated = () => {
      setRefreshKey((k) => k + 1)
    }
    window.addEventListener('album-created', handleAlbumCreated)
    return () => window.removeEventListener('album-created', handleAlbumCreated)
  }, [])

  const fetchAlbums = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/albums?page=${page}&limit=20`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      const fetchedAlbums: Album[] = data.albums ?? []
      setAlbums(fetchedAlbums)
      setPagination(data.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      setAlbums([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    refreshKeyRef.current = refreshKey
    fetchAlbums()
  }, [fetchAlbums, refreshKey])

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('list.title')}</h1>
        <div className="flex gap-4">
          <Link
            href="/songs"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            {t('list.songLibrary')}
          </Link>
          <Link
            href="/albums/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('list.new')}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">{tCommon('states.loading')}</div>
      ) : albums.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <div key={album.id} className="relative group">
                <Link href={`/albums/${album.id}`}>
                  <AlbumCard
                    title={album.title}
                    description={album.description}
                    songCount={album.album_songs?.[0]?.count ?? 0}
                    coverUrl={album.cover_url}
                    coverFilePath={album.cover_file_path}
                  />
                </Link>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteConfirmDialog
                    albumId={album.id}
                    albumTitle={album.title}
                    trigger={
                      <button className="rounded-full bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    }
                  />
                </div>
              </div>
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
        <EmptyState title={tCommon('empty.albums.title')} description={tCommon('empty.albums.description')} />
      )}
    </div>
  )
}
