'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@kiyo/ui'
import { useTranslations } from 'next-intl'

interface GenerationPanelProps {
  songId: string
  initialStatus: string
}

export function GenerationPanel({ songId, initialStatus }: GenerationPanelProps) {
  const [status, setStatus] = useState(initialStatus)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const t = useTranslations('songs.detail.status')

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/songs/${songId}`)
      if (!res.ok) return
      const data = await res.json()

      if (data.song.status !== status) {
        setStatus(data.song.status)
        if (data.song.status !== 'generating') {
          router.refresh()
        }
      }
    } catch {
      // silently ignore polling errors
    }
  }, [songId, status, router])

  useEffect(() => {
    if (status !== 'generating') return

    const interval = setInterval(pollStatus, 10000)
    return () => clearInterval(interval)
  }, [status, pollStatus])

  const handleRetry = async () => {
    setErrorMsg('')
    try {
      const res = await fetch('/api/tasks/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: songId }),
      })
      if (res.ok) {
        setStatus('generating')
      } else {
        const data = await res.json()
        setErrorMsg(data.error?.message || t('failed.error'))
      }
    } catch {
      setErrorMsg(t('errors.network'))
    }
  }

  if (status === 'generating') {
    return (
      <div className="mb-6 rounded-lg border p-6 text-center">
        <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{t('generating.title')}</p>
        {t('generating.hint') !== 'generating.hint' && (
          <p className="mt-1 text-xs text-muted-foreground">{t('generating.hint')}</p>
        )}
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="mb-6 rounded-lg border border-destructive/50 p-6 text-center">
        <p className="mb-2 text-sm text-destructive">{t('failed.title')}</p>
        {errorMsg && <p className="mb-3 text-xs text-destructive">{errorMsg}</p>}
        <Button onClick={handleRetry} variant="outline">
          {t('failed.action')}
        </Button>
      </div>
    )
  }

  return null
}
