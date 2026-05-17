'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button, Skeleton } from '@kiyo/ui'
import { Disc3, Music2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from '@kiyo/ui'

interface CoverSectionProps {
  entityId: string
  entityType: 'album' | 'song'
  coverUrl: string | null
  coverFilePath?: string | null
  coverStatus: string
  title: string
  genre?: string | null
  mood?: string | null
}

export function CoverSection({ entityId, entityType, coverUrl, coverFilePath, coverStatus, title }: CoverSectionProps) {
  const [status, setStatus] = useState(coverStatus)
  const [url, setUrl] = useState(coverUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (coverFilePath) {
      fetch('/api/storage/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: 'covers', path: coverFilePath }),
      })
        .then((res) => res.json())
        .then((data) => setUrl(data.signedUrl))
        .catch(() => setUrl(coverUrl))
    } else {
      setUrl(coverUrl)
    }
  }, [coverFilePath, coverUrl])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const t = useTranslations(entityType === 'album' ? 'albums.cover' : 'songs.detail.cover')

  // Poll for cover status changes when generating
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/${entityType}s/${entityId}`)
      if (!res.ok) return
      const data = await res.json()

      const entity = data[entityType]
      if (!entity) return

      if (entity.cover_status !== status) {
        setStatus(entity.cover_status)
        if (entity.cover_file_path) {
          setUrl(entity.cover_file_path)
        } else if (entity.cover_url) {
          setUrl(entity.cover_url)
        }
        if (entity.cover_status !== 'generating') {
          router.refresh()
        }
      }
    } catch {
      // silently ignore polling errors
    }
  }, [entityId, entityType, status, router])

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [status, pollStatus])

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

      // Async mode: receive 202, start polling
      if (res.status === 202) {
        // Already set to generating above, polling will handle the rest
        return
      }

      // Fallback for sync mode (should not happen after migration)
      if (data.coverUrl) {
        setUrl(data.coverUrl)
        setStatus('completed')
        toast.success(t('success'))
      }
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
      toast.error(t('error'))
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

      setUrl(data.coverFilePath || data.coverUrl)
      setStatus('completed')
      toast.success(t('uploadSuccess'))
    } catch (err) {
      setStatus('failed')
      setError(err instanceof Error ? err.message : t('error'))
      toast.error(t('error'))
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
