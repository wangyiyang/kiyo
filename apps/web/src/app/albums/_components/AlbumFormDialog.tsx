'use client'

import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Textarea,
} from '@kiyo/ui'
import { SongSelector } from './SongSelector'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface AlbumFormDialogProps {
  mode: 'create' | 'edit'
  album?: {
    id: string
    title: string
    description: string | null
  }
  trigger: React.ReactNode
}

export function AlbumFormDialog({ mode, album, trigger }: AlbumFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(album?.title ?? '')
  const [description, setDescription] = useState(album?.description ?? '')
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.form')
  const tCommon = useTranslations('common')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      const url = mode === 'create' ? '/api/albums' : `/api/albums/${album!.id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const body: Record<string, any> = { title, description: description || null }
      if (selectedSongIds.length > 0) {
        body.song_ids = selectedSongIds
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? tCommon('errors.unknown'))
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.unknown'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('name')}</label>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">{t('description')}</label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
              rows={3}
            />
          </div>
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">{t('selectSongs')}</label>
              <SongSelector selectedIds={selectedSongIds} onChange={setSelectedSongIds} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? tCommon('states.submitting') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
