'use client'

import NextLink from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { SongStatusBadge } from './song-status-badge'
import { Music2, Clock, Trash2, Mic2 } from 'lucide-react'

interface SongCardProps {
  id: string
  title: string
  status: 'draft' | 'generating' | 'completed' | 'failed'
  statusLabel: string
  duration?: number | null
  lyricTitle?: string | null
  coverUrl?: string | null
  coverFilePath?: string | null
  href?: string
  onDelete?: (id: string) => void
  onCover?: (id: string) => void
}

export function SongCard({ id, title, status, statusLabel, duration, lyricTitle, coverUrl, coverFilePath, href, onDelete, onCover }: SongCardProps) {
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(coverUrl || null)

  useEffect(() => {
    if (coverFilePath) {
      fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'covers', path: coverFilePath }),
      })
        .then((res) => res.json())
        .then((data) => setResolvedCoverUrl(data.signedUrl))
        .catch(() => setResolvedCoverUrl(coverUrl || null))
    } else {
      setResolvedCoverUrl(coverUrl || null)
    }
  }, [coverFilePath, coverUrl])
  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const card = (
    <div className="group relative rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50">
        {(onDelete || onCover) && (
          <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            {onCover && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onCover(id)
                }}
                className="rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-purple-600"
                aria-label="翻唱"
              >
                <Mic2 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDelete(id)
                }}
                className="rounded-full bg-background/80 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        <div className="mb-3 aspect-video overflow-hidden rounded-md bg-muted">
          {resolvedCoverUrl ? (
            <Image
              src={resolvedCoverUrl}
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
          <h3 className="font-semibold min-w-0 truncate">{title}</h3>
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
