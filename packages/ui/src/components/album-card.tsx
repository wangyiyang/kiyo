'use client'

import Image from 'next/image'
import { Disc3 } from 'lucide-react'
import { useState, useEffect } from 'react'

interface AlbumCardProps {
  title: string
  description?: string | null
  songCount: number
  coverUrl?: string | null
  coverFilePath?: string | null
  onClick?: () => void
}

export function AlbumCard({ title, description, songCount, coverUrl, coverFilePath, onClick }: AlbumCardProps) {
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

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden relative">
        {resolvedCoverUrl ? (
          <Image
            src={resolvedCoverUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        ) : (
          <Disc3 className="h-12 w-12 text-muted-foreground" />
        )}
      </div>
      <h3 className="font-semibold leading-tight">{title}</h3>
      {description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{songCount} 首歌曲</p>
    </div>
  )
}
