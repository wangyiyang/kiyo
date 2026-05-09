'use client'

import { useState, useEffect } from 'react'
import { Input, SongRow } from '@kiyo/ui'
import { useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
}

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  excludeIds?: string[]
  emptyMessage?: string
}

export function SongSelector({ selectedIds, onChange, excludeIds, emptyMessage }: SongSelectorProps) {
  const [songs, setSongs] = useState<Song[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const tCommon = useTranslations('common')

  useEffect(() => {
    fetch('/api/songs')
      .then((res) => res.json())
      .then((data) => {
        setSongs(data.songs ?? [])
        setLoading(false)
      })
  }, [])

  const filteredSongs = songs
    .filter((s) => s.title.toLowerCase().includes(search.toLowerCase()))
    .filter((s) => !excludeIds?.includes(s.id))

  function toggleSong(id: string, selected: boolean) {
    if (selected) {
      onChange([...selectedIds, id])
    } else {
      onChange(selectedIds.filter((sid) => sid !== id))
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">{tCommon('states.loading')}</p>

  return (
    <div className="space-y-3">
      <Input
        placeholder={tCommon('actions.search')}
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.map((song) => (
          <SongRow
            key={song.id}
            id={song.id}
            title={song.title}
            mode="select"
            selected={selectedIds.includes(song.id)}
            onSelect={toggleSong}
          />
        ))}
        {filteredSongs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {emptyMessage ?? tCommon('errors.notFound')}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{tCommon('states.loading')}</p>
    </div>
  )
}
