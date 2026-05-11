'use client'

import NextLink from 'next/link'
import Image from 'next/image'
import { SongStatusBadge } from './song-status-badge'
import { Music2, Clock, Trash2 } from 'lucide-react'

interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  statusLabel: string
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
  href?: string
  onDelete?: (id: string) => void
}

export function SongCard({ id, title, status, statusLabel, duration, lyricTitle, coverUrl, href, onDelete }: SongCardProps) {
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const card = (
    <div className="group relative rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
        {onDelete && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(id)
            }}
            className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
            aria-label="删除"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <div className="mb-3 aspect-video overflow-hidden rounded-md bg-muted">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
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
          {lyricTitle && <span>歌词: {lyricTitle}</span>}
          <span className="ml-auto">
            {status === 'completed' ? '可播放' : status === 'failed' ? '生成失败' : '待生成'}
          </span>
        </div>
      </div>
  )

  if (href) {
    return <NextLink href={href} className="block">{card}</NextLink>
  }

  return card
}
