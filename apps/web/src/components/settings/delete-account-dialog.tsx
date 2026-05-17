'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  cn,
} from '@kiyo/ui'

import { AlertTriangle } from 'lucide-react'

import { createBrowserClient } from '@kiyo/supabase'

type Step = 'warn' | 'verify' | 'confirm' | 'deleting' | 'done'

interface DeleteAccountDialogProps {
  userEmail: string
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const [open, setOpen] = React.useState(false)
  const [step, setStep] = React.useState<Step>('warn')
  const [password, setPassword] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')
  const [error, setError] = React.useState('')
  const router = useRouter()

  const reset = () => {
    setStep('warn')
    setPassword('')
    setConfirmation('')
    setError('')
  }

  React.useEffect(() => {
    if (!open) reset()
  }, [open])

  const handleVerify = async () => {
    setError('')

    if (!password) {
      setError(t('dangerZone.deleteAccount.dialog.verifyDescription'))
      return
    }

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'VERIFY', password }),
      })

      const result = await response.json()

      if (response.status === 403) {
        setError(t('dangerZone.deleteAccount.dialog.verifyDescription'))
        return
      }

      if (response.status === 400 && result.error?.code === 'NO_PASSWORD_SET') {
        setError(t('dangerZone.deleteAccount.dialog.noPassword'))
        return
      }

      if (response.status === 400) {
        setError(result.error?.message || t('dangerZone.deleteAccount.dialog.error'))
        return
      }

      setStep('confirm')
    } catch {
      setError(t('dangerZone.deleteAccount.dialog.error'))
    }
  }

  const handleDelete = async () => {
    if (confirmation !== 'DELETE') {
      setError(t('dangerZone.deleteAccount.dialog.confirmDescription'))
      return
    }

    setStep('deleting')
    setError('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE', password }),
      })

      if (!response.ok) {
        const result = await response.json()
        setError(result.error?.message || t('dangerZone.deleteAccount.dialog.error'))
        setStep('confirm')
        return
      }

      setStep('done')

      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch {
      setError(t('dangerZone.deleteAccount.dialog.error'))
      setStep('confirm')
    }
  }

  const isDangerStep = step === 'warn' || step === 'verify' || step === 'confirm'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="border-red-300 dark:border-red-800">
          {t('dangerZone.deleteAccount.button')}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          'sm:max-w-md',
          isDangerStep && 'border-red-200 dark:border-red-900'
        )}
      >
        {step === 'warn' && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <DialogHeader className="mb-4">
                <DialogTitle className="text-red-600 dark:text-red-400">
                  {t('dangerZone.deleteAccount.dialog.warnTitle')}
                </DialogTitle>
                <DialogDescription className="text-red-500/80 dark:text-red-400/80">
                  {t('dangerZone.deleteAccount.dialog.warnDescription')}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => setStep('verify')}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <DialogHeader className="mb-4">
                <DialogTitle className="text-red-600 dark:text-red-400">
                  {t('dangerZone.deleteAccount.dialog.verifyTitle')}
                </DialogTitle>
                <DialogDescription>
                  {t('dangerZone.deleteAccount.dialog.verifyDescription')}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder={t('dangerZone.deleteAccount.dialog.verifyPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerify()
                }}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('warn')}>
                {tCommon('actions.back')}
              </Button>
              <Button variant="destructive" onClick={handleVerify}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <DialogHeader className="mb-4">
                <DialogTitle className="text-red-600 dark:text-red-400">
                  {t('dangerZone.deleteAccount.dialog.confirmTitle')}
                </DialogTitle>
                <DialogDescription className="text-red-500/80 dark:text-red-400/80">
                  {t('dangerZone.deleteAccount.dialog.confirmDescription')}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="space-y-4 py-4">
              <Input
                placeholder={t('dangerZone.deleteAccount.dialog.confirmPlaceholder')}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDelete()
                }}
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('verify')}>
                {tCommon('actions.back')}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                {t('dangerZone.deleteAccount.dialog.confirmButton')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'deleting' && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-muted-foreground">
              {t('dangerZone.deleteAccount.dialog.deleting')}
            </p>
          </div>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.success')}</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => router.push('/')}>{tCommon('actions.done')}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
