'use client'

import { useEffect, useCallback } from 'react'
import { usePlayerStore } from '../store/usePlayerStore'

function isTextInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    target.isContentEditable
  )
}

export function usePlayerKeyboard() {
  const store = usePlayerStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isTextInputElement(e.target)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          store.togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          store.seek(store.currentTime + 5)
          break
        case 'ArrowLeft':
          e.preventDefault()
          store.seek(store.currentTime - 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          store.setVolume(store.volume + 0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          store.setVolume(store.volume - 0.1)
          break
        case 'n':
        case 'N':
          store.next()
          break
        case 'p':
        case 'P':
          store.prev()
          break
        case 'm':
        case 'M':
          store.toggleMute()
          break
      }
    },
    [store]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
