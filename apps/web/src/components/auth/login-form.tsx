'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Separator } from '@kiyo/ui'

import { PasswordLoginForm } from './password-login-form'
import { MagicLinkForm } from './magic-link-form'

type Mode = 'password' | 'magicLink'

export function LoginForm() {
  const t = useTranslations('auth')
  const [mode, setMode] = React.useState<Mode>('password')

  return (
    <div className="space-y-4">
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
