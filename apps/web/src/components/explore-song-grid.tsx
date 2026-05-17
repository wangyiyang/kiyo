'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { EmptyState } from '@kiyo/ui'
import { ShowcaseCard } from '@/components/sections/showcase-card'

interface Track {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  cover_file_path: string | null
  audio_url: string | null
  file_path: string | null
  duration: number | null
}

interface ExploreSongGridProps {
  genre?: string
  mood?: string
  query?: string
}

const trackGradients = [
  'from-indigo-500 to-cyan-400',
  'from-amber-400 to-pink-400',
  'from-rose-500 to-violet-500',
  'from-sky-500 to-emerald-400',
  'from-fuchsia-500 to-orange-400',
  'from-purple-400 to-pink-300',
]

export function ExploreSongGrid({ genre, mood, query }: ExploreSongGridProps) {
  const t = useTranslations('explore')
  const tCommon = useTranslations('common')
  const [songs, setSongs] = useState<Track[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async (options?: { force?: boolean }) => {
    if (isLoading || !hasMore || (error && !options?.force)) return

    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '18')
    if (genre) params.set('genre', genre)
    if (mood) params.set('mood', mood)
    if (query) params.set('q', query)

    try {
      const res = await fetch(`/api/explore/songs?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to load songs: ${res.status}`)
      }
      const data = await res.json()
      const newSongs: Track[] = data.songs ?? []
      const pagination = data.pagination ?? { hasMore: false }

      setSongs((prev) => [...prev, ...newSongs])
      setHasMore(pagination.hasMore)
      setPage((prev) => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : tCommon('errors.unknown'))
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, error, page, genre, mood, query, tCommon])

  // Reset state when filters or search query change.
  useEffect(() => {
    setSongs([])
    setPage(1)
    setHasMore(true)
    setError(null)
    setIsLoading(false)
  }, [genre, mood, query])

  // Trigger first load when page=1 and songs empty
  useEffect(() => {
    if (page === 1 && songs.length === 0 && !isLoading && !error) {
      loadMore()
    }
  }, [page, songs.length, isLoading, error, loadMore])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div>
      {songs.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((track, index) => (
            <ShowcaseCard
              key={track.id}
              track={track}
              index={index}
              playlist={songs}
              gradient={trackGradients[index % trackGradients.length]}
            />
          ))}
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* Bottom states */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => loadMore({ force: true })}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t('retry')}
          </button>
        </div>
      )}

      {!hasMore && songs.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('allLoaded')}
        </p>
      )}

      {!hasMore && songs.length === 0 && !isLoading && !error && (
        <EmptyState
          title={query ? t('empty.searchTitle') : t('empty.title')}
          description={query ? t('empty.searchDescription', { query }) : t('empty.description')}
        />
      )}
    </div>
  )
}
