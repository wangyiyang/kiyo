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

interface ExportDialogProps {
  songId: string
  songTitle: string
  disabled?: boolean
}

export function ExportDialog({ songId, songTitle, disabled }: ExportDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/songs/${songId}/export`)
      const data = await res.json()
      if (res.ok && data.downloadUrl) {
        // Create hidden anchor to trigger download with proper filename
        const link = document.createElement('a')
        link.href = data.downloadUrl
        link.download = data.filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        setOpen(false)
        toast.success('已开始下载')
      } else {
        toast.error(data.error?.message || '导出失败，请稍后重试')
      }
    } catch {
      toast.error('导出失败，请检查网络连接')
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
        导出
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导出音频</DialogTitle>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">歌曲</span>
            <span className="font-medium">{songTitle}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">格式</span>
            <span className="font-medium">MP3</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? '准备中...' : '确认导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
