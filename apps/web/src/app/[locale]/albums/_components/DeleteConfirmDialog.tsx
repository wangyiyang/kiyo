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
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface DeleteConfirmDialogProps {
  albumId: string
  albumTitle: string
  trigger: React.ReactNode
}

export function DeleteConfirmDialog({ albumId, albumTitle, trigger }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const t = useTranslations('albums.delete')
  const tCommon = useTranslations('common')

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? tCommon('errors.deleteFailed'))
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : tCommon('errors.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t.rich('description', { title: albumTitle, strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? tCommon('states.deleting') : tCommon('actions.delete')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
