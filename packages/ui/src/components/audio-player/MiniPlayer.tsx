'use client'

import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'
import { Play, Pause, SkipBack, SkipForward, ChevronUp, ChevronDown, X, Music2 } from 'lucide-react'
import { PlaylistPanel } from './PlaylistPanel'
import { ProgressBar } from './ProgressBar'

export function MiniPlayer() {
  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isVisible = usePlayerStore((s) => s.isMiniPlayerVisible)
  const isExpanded = usePlayerStore((s) => s.isMiniPlayerExpanded)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const setMiniPlayerExpanded = usePlayerStore((s) => s.setMiniPlayerExpanded)
  const stopAndHide = usePlayerStore((s) => s.stopAndHide)

  if (!isVisible || !currentTrack) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/90 backdrop-blur-md">
      {/* Collapsed bar */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Cover */}
        <button
          onClick={() => setMiniPlayerExpanded(!isExpanded)}
          className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/5"
        >
          {currentTrack.cover_url ? (
            <img
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Music2 size={16} className="text-white/40" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition hover:opacity-100">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </div>
        </button>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-white">
            {currentTrack.title}
          </div>
          <div className="truncate text-xs text-white/50">
            {currentTrack.album || '未知专辑'}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </button>
          <button
            onClick={next}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:text-white"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Mini progress */}
        <div className="hidden w-20 sm:block">
          <ProgressBar />
        </div>

        {/* Expand / Close */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMiniPlayerExpanded(!isExpanded)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:text-white"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            onClick={stopAndHide}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expanded playlist panel */}
      {isExpanded && (
        <div className="border-t border-white/5">
          <PlaylistPanel className="py-2" />
        </div>
      )}
    </div>
  )
}
