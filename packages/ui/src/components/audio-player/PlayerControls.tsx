'use client'

import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface PlayerControlsProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function PlayerControls({ className, size = 'md' }: PlayerControlsProps) {
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const repeatMode = usePlayerStore((s) => s.repeatMode)
  const isShuffle = usePlayerStore((s) => s.isShuffle)
  const playlist = usePlayerStore((s) => s.playlist)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const next = usePlayerStore((s) => s.next)
  const prev = usePlayerStore((s) => s.prev)
  const cycleRepeatMode = usePlayerStore((s) => s.cycleRepeatMode)
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle)

  const hasPlaylist = playlist.length > 0

  const btnSize =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const playSize =
    size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-16 w-16' : 'h-12 w-12'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 24 : 18
  const playIconSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 24

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      <button
        onClick={toggleShuffle}
        className={cn(
          'flex items-center justify-center rounded-full text-white/60 transition hover:text-white',
          btnSize,
          isShuffle && 'text-primary'
        )}
        title="随机播放"
      >
        <Shuffle size={iconSize} />
      </button>

      <button
        onClick={prev}
        disabled={!hasPlaylist}
        className={cn(
          'flex items-center justify-center rounded-full text-white/80 transition hover:text-white disabled:opacity-30',
          btnSize
        )}
        title="上一首 (P)"
      >
        <SkipBack size={iconSize} />
      </button>

      <button
        onClick={togglePlay}
        className={cn(
          'flex items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105',
          playSize
        )}
        title="播放/暂停 (Space)"
      >
        {isPlaying ? <Pause size={playIconSize} /> : <Play size={playIconSize} className="ml-0.5" />}
      </button>

      <button
        onClick={next}
        disabled={!hasPlaylist}
        className={cn(
          'flex items-center justify-center rounded-full text-white/80 transition hover:text-white disabled:opacity-30',
          btnSize
        )}
        title="下一首 (N)"
      >
        <SkipForward size={iconSize} />
      </button>

      <button
        onClick={cycleRepeatMode}
        className={cn(
          'flex items-center justify-center rounded-full text-white/60 transition hover:text-white',
          btnSize,
          repeatMode !== 'off' && 'text-primary'
        )}
        title="循环模式"
      >
        {repeatMode === 'one' ? <Repeat1 size={iconSize} /> : <Repeat size={iconSize} />}
      </button>
    </div>
  )
}
