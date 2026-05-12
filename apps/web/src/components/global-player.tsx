'use client'

import { AudioEngine, MiniPlayer, usePlayerKeyboard } from '@kiyo/ui'
import { useTranslations } from 'next-intl'

export function GlobalPlayer() {
  usePlayerKeyboard()
  const t = useTranslations('player')

  return (
    <>
      <AudioEngine />
      <MiniPlayer
        labels={{
          prev: t('prev'),
          next: t('next'),
          play: t('play'),
          pause: t('pause'),
          expand: t('expand'),
          collapse: t('collapse'),
          close: t('close'),
        }}
      />
    </>
  )
}
