'use client'

import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { cn } from '../../lib/utils'

interface SpectrumVisualizerProps {
  className?: string
  barCount?: number
}

const FFT_SIZE = 256
const DEFAULT_BAR_COUNT = 48
const SMOOTHING = 0.7

export function SpectrumVisualizer({
  className,
  barCount = DEFAULT_BAR_COUNT,
}: SpectrumVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const prevHeightsRef = useRef<number[]>(new Array(barCount).fill(0))
  const analyserData = usePlayerStore((s) => s.analyserData)
  const isPlaying = usePlayerStore((s) => s.isPlaying)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number

    const draw = () => {
      raf = requestAnimationFrame(draw)

      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)

      if (!analyserData || !isPlaying) {
        const barWidth = width / barCount
        const gap = 2
        for (let i = 0; i < barCount; i++) {
          const x = i * barWidth + gap / 2
          const h = 2
          const y = height - h
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.fillRect(x, y, barWidth - gap, h)
        }
        return
      }

      const binCount = analyserData.length
      const barsPerBin = Math.floor(binCount / barCount)
      const barWidth = width / barCount
      const gap = 2

      for (let i = 0; i < barCount; i++) {
        let sum = 0
        const start = i * barsPerBin
        const end = Math.min(start + barsPerBin, binCount)
        for (let j = start; j < end; j++) {
          sum += analyserData[j]
        }
        const avg = sum / (end - start)
        const targetHeight = (avg / 255) * height * 0.9

        const smoothed =
          SMOOTHING * prevHeightsRef.current[i] +
          (1 - SMOOTHING) * targetHeight

        prevHeightsRef.current[i] = smoothed

        const x = i * barWidth + gap / 2
        const h = Math.max(2, smoothed)
        const y = height - h

        const gradient = ctx.createLinearGradient(0, height, 0, y)
        gradient.addColorStop(0, '#ec4899')
        gradient.addColorStop(1, '#8b5cf6')
        ctx.fillStyle = gradient
        ctx.fillRect(x, y, barWidth - gap, h)
      }
    }

    draw()

    return () => cancelAnimationFrame(raf)
  }, [analyserData, isPlaying, barCount])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={80}
      className={cn('w-full', className)}
      style={{ imageRendering: 'auto' }}
    />
  )
}
