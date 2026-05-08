'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'

import {
  Button,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  toast,
} from '@kiyo/ui'

import { signInWithPassword } from '@/app/actions/auth'
import { loginSchema, type LoginInput } from '@/lib/schemas/auth'

export function PasswordLoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
    mode: 'onBlur',
  })

  const onSubmit = (values: LoginInput) => {
    startTransition(async () => {
      const result = await signInWithPassword(values.email, values.password)
      if (result.ok) {
        toast.success(t('login.submit'), {
          description: t('login.subtitle'),
        })
        const redirectTo = searchParams.get('redirectTo') ?? '/'
        router.push(redirectTo)
        router.refresh()
        return
      }

      const errorKey =
        result.code === 'email_not_confirmed'
          ? 'errors.emailNotConfirmed'
          : result.code === 'invalid_credentials'
            ? 'errors.invalidCredentials'
            : 'errors.generic'

      toast.error(t('errors.generic'), {
        description: t(errorKey),
      })
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login.email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('login.email.placeholder')}
                  autoComplete="email"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login.password.label')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.password.placeholder')}
                    autoComplete="current-password"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4 rounded border-border"
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">
                  {t('login.rememberMe')}
                </FormLabel>
              </FormItem>
            )}
          />
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('login.forgotPassword')}
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>
    </Form>
  )
}
