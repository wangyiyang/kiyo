'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kiyo/ui'
import { SongSelector } from '../../_components/SongSelector'
import { Plus } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface AddSongsDialogProps {
  albumId: string
  excludeIds: string[]
}

export function AddSongsDialog({ albumId, excludeIds }: AddSongsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.addSongs')
  const tCommon = useTranslations('common')

  function handleOpenChange(open: boolean) {
    setOpen(open)
    if (!open) {
      setSelectedIds([])
    }
  }

  async function handleSubmit() {
    if (selectedIds.length === 0) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: selectedIds }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: tCommon('errors.addFailed') } }))
        throw new Error(error.error?.message ?? tCommon('errors.addFailed'))
      }

      setOpen(false)
      setSelectedIds([])
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.addFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          {tCommon('actions.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SongSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            excludeIds={excludeIds}
            emptyMessage={t('empty')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? tCommon('states.adding') : t('selectedCount', { count: selectedIds.length })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
