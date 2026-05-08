'use client'

import { useState, useEffect } from 'react'
import { Input, SongRow } from '@kiyo/ui'

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

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>

  return (
    <div className="space-y-3">
      <Input
        placeholder="搜索歌曲..."
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
            {emptyMessage ?? '没有找到匹配的歌曲'}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">已选择 {selectedIds.length} 首歌曲</p>
    </div>
  )
}
