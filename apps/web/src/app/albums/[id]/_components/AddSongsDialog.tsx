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
import { useRouter } from 'next/navigation'

interface AddSongsDialogProps {
  albumId: string
  excludeIds: string[]
}

export function AddSongsDialog({ albumId, excludeIds }: AddSongsDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

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
        const error = await response.json().catch(() => ({ error: { message: '添加失败' } }))
        throw new Error(error.error?.message ?? '添加失败')
      }

      setOpen(false)
      setSelectedIds([])
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          添加歌曲
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>添加歌曲到专辑</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <SongSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            excludeIds={excludeIds}
            emptyMessage="暂无可用歌曲"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || selectedIds.length === 0}
            >
              {submitting ? '添加中...' : `添加 (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
