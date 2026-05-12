'use client'

import { useTranslations } from 'next-intl'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kiyo/ui'

import { WaitlistForm } from './waitlist-form'
import { useWaitlist } from '@/lib/waitlist-context'

export function WaitlistDialog() {
  const { open, setOpen, hide } = useWaitlist()
  const t = useTranslations('waitlist')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <WaitlistForm mode="simple" onSuccess={hide} />
      </DialogContent>
    </Dialog>
  )
}
