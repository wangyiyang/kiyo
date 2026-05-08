'use client'

import { useCallback, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface ProgressBarProps {
  className?: string
}

export function ProgressBar({ className }: ProgressBarProps) {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const barRef = useRef<HTMLDivElement>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = barRef.current
      if (!bar || duration <= 0) return
      const rect = bar.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      seek(ratio * duration)
    },
    [duration, seek]
  )

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={barRef}
        onClick={handleClick}
        className="group relative h-1.5 cursor-pointer rounded-full bg-white/10"
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
          style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-white/50">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
