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
        const error = await response.json()
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          添加歌曲
        </button>
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
            <Button variant="outline" onClick={() => setOpen(false)}>
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
