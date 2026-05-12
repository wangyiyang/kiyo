'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Play, Pause, ListMusic, Music2 } from 'lucide-react'
import { ProgressBar } from './ProgressBar'
import { PlayerControls } from './PlayerControls'
import { VolumeControl } from './VolumeControl'
import { SpectrumVisualizer } from './SpectrumVisualizer'
import { PlaylistPanel } from './PlaylistPanel'

export interface AudioPlayerProps {
  src: string
  filePath?: string | null
  title?: string
  album?: string
  coverUrl?: string | null
  coverFilePath?: string | null
  duration?: number | null
  songId?: string
  playlist?: Array<{
    id: string
    title: string
    audio_url: string
    file_path?: string | null
    cover_url?: string | null
    duration?: number | null
    album?: string | null
  }>
  className?: string
}

export function AudioPlayer({
  src,
  filePath,
  title,
  album,
  coverUrl,
  coverFilePath,
  duration,
  songId,
  playlist,
  className,
}: AudioPlayerProps) {
  const store = usePlayerStore()
  const [showPlaylist, setShowPlaylist] = useState(false)
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(coverUrl || null)

  useEffect(() => {
    if (coverUrl) {
      setResolvedCoverUrl(coverUrl)
    } else if (coverFilePath) {
      fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'covers', path: coverFilePath }),
      })
        .then((res) => res.json())
        .then((data) => setResolvedCoverUrl(data.signedUrl || null))
        .catch(() => setResolvedCoverUrl(null))
    } else {
      setResolvedCoverUrl(null)
    }
  }, [coverFilePath, coverUrl])

  const isCurrentTrack = store.currentTrack?.audio_url === src || (filePath ? store.currentTrack?.file_path === filePath : false)
  const isPlaying = isCurrentTrack && store.isPlaying

  const handlePlay = () => {
    if (isCurrentTrack) {
      store.togglePlay()
      return
    }

    const song = {
      id: songId || src,
      title: title || '未知歌曲',
      audio_url: src,
      file_path: filePath || undefined,
      cover_url: resolvedCoverUrl,
      duration,
      album: album || undefined,
    }

    const pl = playlist?.map((s) => ({
      id: s.id,
      title: s.title,
      audio_url: s.audio_url,
      file_path: s.file_path || undefined,
      cover_url: s.cover_url,
      duration: s.duration,
      album: s.album || undefined,
    })) || [song]

    store.play(song, pl)
  }

  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-b from-neutral-900 to-black p-6 text-white',
        className
      )}
    >
      {/* Header: Cover + Info */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-white/5">
          {resolvedCoverUrl ? (
            <Image
            src={resolvedCoverUrl}
            alt={title || '未知歌曲'}
            width={80}
            height={80}
            className="object-cover"
            sizes="80px"
          />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 size={28} className="text-white/30" />
            </div>
          )}
          <button
            onClick={handlePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{title || '未知歌曲'}</h3>
          {album && <p className="truncate text-sm text-white/50">{album}</p>}
        </div>
      </div>

      {/* Visualizer */}
      <div className="mb-4">
        <SpectrumVisualizer className="h-16 rounded-lg bg-white/5" />
      </div>

      {/* Progress */}
      {isCurrentTrack && (
        <div className="mb-4">
          <ProgressBar />
        </div>
      )}

      {/* Controls */}
      <div className="mb-4">
        <PlayerControls size="lg" />
      </div>

      {/* Bottom row: Volume + Playlist toggle */}
      <div className="flex items-center justify-between">
        <VolumeControl />
        {playlist && playlist.length > 0 && (
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition',
              showPlaylist
                ? 'bg-white/10 text-white'
                : 'text-white/50 hover:bg-white/5 hover:text-white/80'
            )}
          >
            <ListMusic size={16} />
            播放列表 ({playlist.length})
          </button>
        )}
      </div>

      {/* Playlist */}
      {showPlaylist && playlist && playlist.length > 0 && (
        <div className="mt-4 rounded-lg bg-white/5">
          <PlaylistPanel />
        </div>
      )}
    </div>
  )
}
