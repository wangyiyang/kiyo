'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ServicePausedBannerProps {
  type?: 'generate' | 'register'
}

export function ServicePausedBanner({ type = 'generate' }: ServicePausedBannerProps) {
  const t = useTranslations('common.servicePaused')

  const isRegister = type === 'register'

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            {isRegister ? t('registerTitle') : t('title')}
          </h3>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            {isRegister ? t('registerMessage') : t('message')}
          </p>
        </div>
      </div>
    </div>
  )
}
