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

interface DeleteConfirmDialogProps {
  albumId: string
  albumTitle: string
  trigger: React.ReactNode
}

export function DeleteConfirmDialog({ albumId, albumTitle, trigger }: DeleteConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? '删除失败')
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          确定要删除专辑 <strong>{albumTitle}</strong> 吗？此操作不可撤销，但不会影响专辑中的歌曲。
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? '删除中...' : '删除'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
