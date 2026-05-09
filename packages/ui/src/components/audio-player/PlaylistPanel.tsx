'use client'

import Image from 'next/image'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Music2 } from 'lucide-react'

interface PlaylistPanelProps {
  className?: string
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlaylistPanel({ className }: PlaylistPanelProps) {
  const playlist = usePlayerStore((s) => s.playlist)
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const play = usePlayerStore((s) => s.play)
  const playlistLength = playlist.length

  if (playlistLength === 0) {
    return (
      <div className={cn('p-4 text-center text-sm text-white/40', className)}>
        暂无播放队列
      </div>
    )
  }

  return (
    <div className={cn('max-h-60 overflow-y-auto', className)}>
      <div className="px-3 py-2 text-xs font-medium text-white/40">
        播放队列 ({playlistLength})
      </div>
      <ul className="space-y-0.5">
        {playlist.map((song, index) => {
          const isActive = currentTrack?.id === song.id
          return (
            <li
              key={song.id}
              onClick={() => play(song, playlist)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white/80'
              )}
            >
              <span className="w-5 text-right text-xs tabular-nums">
                {isActive ? (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1.5 w-0.5 animate-pulse bg-primary" />
                    <span className="h-2 w-0.5 animate-pulse bg-primary [animation-delay:0.1s]" />
                    <span className="h-1 w-0.5 animate-pulse bg-primary [animation-delay:0.2s]" />
                  </span>
                ) : (
                  index + 1
                )}
              </span>

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/5">
                {song.cover_url ? (
                  <Image
                    src={song.cover_url}
                    alt={song.title}
                    width={32}
                    height={32}
                    className="rounded object-cover"
                    sizes="32px"
                  />
                ) : (
                  <Music2 size={14} className="text-white/30" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{song.title}</div>
                {song.album && (
                  <div className="truncate text-xs text-white/40">{song.album}</div>
                )}
              </div>

              <span className="text-xs text-white/40 tabular-nums">
                {formatDuration(song.duration)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
