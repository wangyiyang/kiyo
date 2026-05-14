'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LyricCreateForm } from '@/components/lyrics/lyric-create-form'

export default function NewLyricPage() {
  const router = useRouter()
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <LyricCreateForm
        onSuccess={(lyricId) => router.push(`/lyrics/${lyricId}`)}
      />
    </div>
  )
}
