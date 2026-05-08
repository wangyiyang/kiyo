import Link from 'next/link'
import { cn } from '../lib/utils'
import { SongStatusBadge } from './song-status-badge'
import { Music2, Clock } from 'lucide-react'

interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
}

export function SongCard({ id, title, status, duration, lyricTitle, coverUrl }: SongCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Link href={`/songs/${id}`}>
      <div className="group rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
        <div className="mb-3 aspect-video overflow-hidden rounded-md bg-muted">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center gap-2">
          <h3 className="font-semibold">{title}</h3>
          <SongStatusBadge status={status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(duration)}
            </span>
          )}
          {lyricTitle && <span>歌词: {lyricTitle}</span>}
          <span className="ml-auto">
            {status === 'completed' ? '可播放' : status === 'failed' ? '生成失败' : '待生成'}
          </span>
        </div>
      </div>
    </Link>
  )
}
