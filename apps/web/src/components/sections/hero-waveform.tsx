'use client'

import { motion, useReducedMotion } from 'framer-motion'

const BAR_COUNT = 48
const BAR_GAP = 12
const BAR_WIDTH = 6
const BASE_Y = 50
const BAR_HEIGHT = 100

export function HeroWaveform({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  const bars = Array.from({ length: BAR_COUNT })

  return (
    <svg
      viewBox={`0 0 ${BAR_COUNT * BAR_GAP} 200`}
      className={className}
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient id="kiyo-wave-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(var(--kiyo-purple))" />
          <stop offset="100%" stopColor="hsl(var(--kiyo-cyan))" />
        </linearGradient>
      </defs>
      {bars.map((_, i) => (
        <motion.rect
          key={i}
          x={i * BAR_GAP}
          y={BASE_Y}
          width={BAR_WIDTH}
          height={BAR_HEIGHT}
          rx={3}
          fill="url(#kiyo-wave-grad)"
          style={{ transformOrigin: 'center', transformBox: 'fill-box' }}
          initial={{ scaleY: 0.4 }}
          animate={
            reduce
              ? { scaleY: 0.6 }
              : { scaleY: [0.4, 1, 0.6, 0.9, 0.4] }
          }
          transition={{
            duration: 1.6 + (i % 4) * 0.3,
            repeat: reduce ? 0 : Infinity,
            ease: 'easeInOut',
            delay: i * 0.04,
          }}
        />
      ))}
    </svg>
  )
}
