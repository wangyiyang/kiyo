'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SongCreateForm } from '@/components/songs/song-create-form'
import { ServicePausedBanner } from '@/components/service-paused-banner'

export default function NewSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <ServicePausedBanner />

      <div className="pointer-events-none opacity-50">
        <SongCreateForm
        lyrics={lyrics}
        onSuccess={(songId) => router.push(`/songs/${songId}`)}
      />
      </div>
    </div>
  )
}
