'use client'

import * as React from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

import { Separator } from '@kiyo/ui'

import { PasswordLoginForm } from './password-login-form'
import { MagicLinkForm } from './magic-link-form'
import { OAuthButtons } from './oauth-buttons'

type Mode = 'password' | 'magicLink'

export function LoginForm() {
  const t = useTranslations('auth')
  const [mode, setMode] = React.useState<Mode>('password')

  return (
    <div className="space-y-4">
      <OAuthButtons />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">或</span>
        <Separator className="flex-1" />
      </div>
      {mode === 'password' ? (
        <>
          <PasswordLoginForm />
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode('magicLink')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t('login.magicLink.use')}
            </button>
          </div>
        </>
      ) : (
        <MagicLinkForm onBack={() => setMode('password')} />
      )}

      <Separator />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {t('login.noAccount')}{' '}
          <Link
            href="/register"
            className="font-medium text-foreground hover:underline"
          >
            {t('login.registerLink')}
          </Link>
        </span>
      </div>
    </div>
  )
}
