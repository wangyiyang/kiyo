'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface VolumeControlProps {
  className?: string
}

export function VolumeControl({ className }: VolumeControlProps) {
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const toggleMute = usePlayerStore((s) => s.toggleMute)

  const displayVolume = isMuted ? 0 : volume

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={toggleMute}
        className="text-white/60 transition hover:text-white"
        title="静音 (M)"
      >
        {isMuted || displayVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      <div className="relative h-1 w-20 cursor-pointer rounded-full bg-white/10">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/60 transition-all"
          style={{ width: `${displayVolume * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={displayVolume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
          aria-label="音量"
        />
      </div>
    </div>
  )
}
