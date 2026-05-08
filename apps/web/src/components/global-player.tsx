'use client'

import { AudioEngine, MiniPlayer, usePlayerKeyboard } from '@kiyo/ui'

export function GlobalPlayer() {
  usePlayerKeyboard()

  return (
    <>
      <AudioEngine />
      <MiniPlayer />
    </>
  )
}
