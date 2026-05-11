'use client'

import * as React from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kiyo/ui'
import { toast } from '@kiyo/ui'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ExportDialogProps {
  songId: string
  songTitle: string
  disabled?: boolean
}

export function ExportDialog({ songId, songTitle, disabled }: ExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const t = useTranslations('songs.export')
  const tCommon = useTranslations('common')

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/songs/${songId}/export`)
      const data = await res.json()
      if (res.ok && data.downloadUrl) {
        const link = document.createElement('a')
        link.href = data.downloadUrl
        link.download = data.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setOpen(false)
        toast.success(t('success'))
      } else {
        toast.error(data.error?.message || tCommon('errors.exportFailed'))
      }
    } catch {
      toast.error(tCommon('errors.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Download className="mr-1 h-4 w-4" />
        {tCommon('actions.export')}
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('song')}</span>
            <span className="font-medium">{songTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('format')}</span>
            <span className="font-medium">{t('formatValue')}</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? tCommon('states.exporting') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
