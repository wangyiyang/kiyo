'use client'

import { useRef, useState } from 'react'
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
  ariaLabel?: string
}

export function ProgressBar({ className, ariaLabel = 'Progress' }: ProgressBarProps) {
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const seek = usePlayerStore((s) => s.seek)
  const endSeek = usePlayerStore((s) => s.endSeek)
  const barRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const dragProgress = duration > 0 ? (dragTime / duration) * 100 : 0
  const displayProgress = isDragging ? dragProgress : progress
  const displayTime = isDragging ? dragTime : currentTime

  const getTimeFromClientX = (clientX: number) => {
    const bar = barRef.current
    if (!bar || duration <= 0) return 0
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return
    const time = getTimeFromClientX(e.clientX)
    setIsDragging(true)
    setDragTime(time)
    seek(time)

    const handleMouseMove = (ev: MouseEvent) => {
      const t = getTimeFromClientX(ev.clientX)
      setDragTime(t)
      seek(t)
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      endSeek()
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (duration <= 0 || e.touches.length !== 1) return
    const time = getTimeFromClientX(e.touches[0].clientX)
    setIsDragging(true)
    setDragTime(time)
    seek(time)

    const handleTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return
      ev.preventDefault()
      const t = getTimeFromClientX(ev.touches[0].clientX)
      setDragTime(t)
      seek(t)
    }
    const handleTouchEnd = () => {
      setIsDragging(false)
      endSeek()
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
  }

  return (
    <div className={cn('w-full select-none', className)}>
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="group relative cursor-pointer py-3"
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(displayTime)}
        tabIndex={0}
      >
        <div className="relative h-1.5 rounded-full bg-white/10">
          <div
            className={cn(
              'absolute left-0 top-0 h-full rounded-full bg-white',
              !isDragging && 'transition-all duration-150'
            )}
            style={{ width: `${displayProgress}%` }}
          />
          <div
            className={cn(
              'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow',
              isDragging
                ? 'opacity-100'
                : 'opacity-0 transition-opacity group-hover:opacity-100'
            )}
            style={{
              left: `${displayProgress}%`,
              transform: `translate(-50%, -50%)`,
            }}
          />
        </div>
      </div>
      <div className="flex justify-between text-xs text-white/50">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
