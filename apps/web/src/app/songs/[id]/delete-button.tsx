'use client'

import { useState } from 'react'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@kiyo/ui'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface DeleteButtonProps {
  songId: string
  songTitle: string
}

export function DeleteButton({ songId, songTitle }: DeleteButtonProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const t = useTranslations('songs.detail')
  const tCommon = useTranslations('common')

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/songs/${songId}`, { method: 'DELETE' })
      if (res.ok) {
        setOpen(false)
        router.push('/songs')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      alert(tCommon('errors.unknown'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="mr-1 h-4 w-4" />
        {t('delete')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirmDescription', { title: songTitle })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              {tCommon('actions.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? tCommon('states.deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
