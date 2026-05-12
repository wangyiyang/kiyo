'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2 } from 'lucide-react'

import { WaitlistForm } from './waitlist-form'

export function InlineWaitlistForm() {
  const [submitted, setSubmitted] = React.useState(false)
  const t = useTranslations('waitlist')

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-center text-lg font-medium">{t('inline.thanks')}</p>
      </div>
    )
  }

  return (
    <WaitlistForm
      mode="full"
      collapsible
      onSuccess={() => setSubmitted(true)}
    />
  )
}
