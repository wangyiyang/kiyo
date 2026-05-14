'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Song {
  id: string
  title: string
}

interface DraggableSongListProps {
  songs: Song[]
  albumId: string
  onReorder?: (newOrder: Song[]) => void
}

function SortableSongRow({ song, index }: { song: Song; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-6 text-center text-sm text-muted-foreground">{index + 1}</span>
      <span className="flex-1 text-sm font-medium">{song.title}</span>
    </div>
  )
}

export function DraggableSongList({ songs: initialSongs, albumId, onReorder }: DraggableSongListProps) {
  const [songs, setSongs] = useState(initialSongs)
  const [isSaving, setIsSaving] = useState(false)
  const t = useTranslations('albums.reorder')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = songs.findIndex((s) => s.id === active.id)
    const newIndex = songs.findIndex((s) => s.id === over.id)
    const newSongs = arrayMove(songs, oldIndex, newIndex)
    setSongs(newSongs)

    setIsSaving(true)
    try {
      const response = await fetch(`/api/albums/${albumId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_ids: newSongs.map((s) => s.id) }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message ?? t('failed'))
      }

      onReorder?.(newSongs)
    } catch (err) {
      setSongs(songs)
      alert(err instanceof Error ? err.message : t('failed'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      {isSaving && (
        <p className="mb-2 text-xs text-muted-foreground">{t('saving')}</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={songs.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {songs.map((song, index) => (
              <SortableSongRow key={song.id} song={song} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
