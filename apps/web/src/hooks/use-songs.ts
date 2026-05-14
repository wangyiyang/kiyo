'use client'

import { useState, useEffect, useCallback } from 'react'

interface Song {
  id: string
  title: string
}

interface UseSongsResult {
  songs: Song[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useSongs(): UseSongsResult {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSongs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/songs')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      setSongs(data.songs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSongs()
  }, [fetchSongs])

  return { songs, loading, error, refetch: fetchSongs }
}
