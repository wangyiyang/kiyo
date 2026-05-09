'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3, Music2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface CoverSectionProps {
  entityId: string
  entityType: 'album' | 'song'
  coverUrl: string | null
  coverStatus: string
  title: string
  genre?: string | null
  mood?: string | null
}

export function CoverSection({ entityId, entityType, coverUrl, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const t = useTranslations(entityType === 'album' ? 'albums.cover' : 'songs.detail.cover')

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const res = await fetch(`/api/${entityType}s/${entityId}/cover?action=generate`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || t('error'))
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)
    setStatus('generating')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/${entityType}s/${entityId}/cover?action=upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error?.message || t('error'))
      }

      setUrl(data.coverUrl)
      setStatus('completed')
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
    } finally {
      setLoading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const buttonText =
    status === 'generating'
      ? t('generating')
      : status === 'completed'
        ? t('regenerate')
        : status === 'failed'
          ? t('retry')
          : t('generate')

  return (
    <div className="mb-6">
      <div className="relative aspect-square max-w-md rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {status === 'completed' && url ? (
          <Image src={url} alt={title} fill className="object-cover" />
        ) : status === 'generating' ? (
          <Skeleton className="h-full w-full" />
        ) : entityType === 'album' ? (
          <Disc3 className="h-24 w-24 text-muted-foreground" />
        ) : (
          <Music2 className="h-24 w-24 text-muted-foreground" />
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={handleGenerate} disabled={loading || status === 'generating'}>
          {buttonText}
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || status === 'generating'}
          variant="outline"
        >
          <Upload className="mr-1 h-4 w-4" />
          {status === 'completed' ? t('replace') : t('upload')}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
