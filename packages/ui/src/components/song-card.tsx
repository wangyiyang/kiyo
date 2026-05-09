import { SongStatusBadge } from './song-status-badge'
import { Music2, Clock, Mic2 } from 'lucide-react'

interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  statusLabel: string
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
  href?: string
  coverHref?: string
  coverLabel?: string
}

export function SongCard({ title, status, statusLabel, duration, lyricTitle, coverUrl, href, coverHref, coverLabel }: SongCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const content = (
    <>
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
        <SongStatusBadge status={status} label={statusLabel} />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {duration && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(duration)}
          </span>
        )}
        {lyricTitle && <span className="truncate">{lyricTitle}</span>}
      </div>
    </>
  )

  const showCoverAction = !!coverHref

  return (
    <div className="group relative rounded-lg border bg-card shadow-sm transition-colors hover:bg-muted/50 overflow-hidden">
      {href ? (
        <a href={href} className="block p-4">
          {content}
        </a>
      ) : (
        <div className="p-4">{content}</div>
      )}
      {showCoverAction && (
        <a
          href={coverHref}
          aria-label={coverLabel || 'AI Cover'}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-primary/90"
        >
          <Mic2 className="h-4 w-4" />
        </a>
      )}
    </div>
  )
}
