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
import { useRouter } from 'next/navigation'

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
        throw new Error(error.error?.message ?? '操作失败')
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建专辑' : '编辑专辑'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">专辑名称</label>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="输入专辑名称"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">描述（可选）</label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="输入专辑描述"
              rows={3}
            />
          </div>
          {mode === 'create' && (
            <div>
              <label className="mb-1 block text-sm font-medium">选择歌曲</label>
              <SongSelector selectedIds={selectedSongIds} onChange={setSelectedSongIds} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? '保存中...' : mode === 'create' ? '创建' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
