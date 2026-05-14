'use client'

import { useState } from 'react'
import { Input, SongRow } from '@kiyo/ui'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useSongs } from '@/hooks/use-songs'

interface SongSelectorProps {
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
  excludeIds?: string[]
  emptyMessage?: string
}

export function SongSelector({ selectedIds, onChange, excludeIds, emptyMessage }: SongSelectorProps) {
  const [search, setSearch] = useState('')
  const { songs, loading, error } = useSongs()
  const tCommon = useTranslations('common')

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

  if (loading) {
    return <p className="text-sm text-muted-foreground">{tCommon('states.loading')}</p>
  }

  if (error) {
    const isUnauthorized =
      error.message.includes('401') || error.message.includes('Authentication required')
    if (isUnauthorized) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{tCommon('errors.loginRequired')}</p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            {tCommon('actions.login')}
          </Link>
        </div>
      )
    }
    return <p className="text-sm text-muted-foreground">{tCommon('errors.loadFailed')}</p>
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder={tCommon('actions.search')}
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {filteredSongs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage ?? tCommon('errors.notFound')}</p>
        ) : (
          filteredSongs.map((song) => (
            <SongRow
              key={song.id}
              id={song.id}
              title={song.title}
              mode="select"
              selected={selectedIds.includes(song.id)}
              onSelect={toggleSong}
            />
          ))
        )}
      </div>
    </div>
  )
}
