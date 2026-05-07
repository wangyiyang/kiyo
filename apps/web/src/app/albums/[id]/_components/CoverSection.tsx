'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3 } from 'lucide-react'

interface CoverSectionProps {
  albumId: string
  coverUrl: string | null
  coverStatus: string
  title: string
}

export function CoverSection({ albumId, coverUrl, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const res = await fetch(`/api/albums/${albumId}/generate-cover`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || '封面生成失败')
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const buttonText =
    status === 'generating'
      ? '生成中...'
      : status === 'completed'
        ? '重新生成'
        : status === 'failed'
          ? '重试'
          : '生成封面'

  return (
    <div className="mb-6">
      <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {status === 'completed' && url ? (
          <Image src={url} alt={title} fill className="object-cover" />
        ) : status === 'generating' ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <Disc3 className="h-24 w-24 text-muted-foreground" />
        )}
      </div>
      <Button
        onClick={handleGenerate}
        disabled={loading || status === 'generating'}
        className="mt-3"
      >
        {buttonText}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
