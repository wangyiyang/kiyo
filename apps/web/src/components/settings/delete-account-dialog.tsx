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
} from '@kiyo/ui'

import { createBrowserClient } from '@kiyo/supabase'

type Step = 'warn' | 'verify' | 'confirm' | 'deleting' | 'done'

interface DeleteAccountDialogProps {
  userEmail: string
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const t = useTranslations('settings')
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t('dangerZone.deleteAccount.button')}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {step === 'warn' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.warnTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.warnDescription')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep('verify')}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.verifyTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.verifyDescription')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                placeholder="Current password"
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
                Back
              </Button>
              <Button variant="destructive" onClick={handleVerify}>
                {t('dangerZone.deleteAccount.dialog.continue')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>{t('dangerZone.deleteAccount.dialog.confirmTitle')}</DialogTitle>
              <DialogDescription>
                {t('dangerZone.deleteAccount.dialog.confirmDescription')}
              </DialogDescription>
            </DialogHeader>
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
                Back
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
              <Button onClick={() => router.push('/')}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
