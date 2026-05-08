'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'

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

import { updatePassword } from '@/app/actions/auth'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/schemas/auth'

export function ResetPasswordForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const code = searchParams.get('code')

  React.useEffect(() => {
    if (!code) {
      setError('Invalid or expired reset link.')
    }
  }, [code])

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onBlur',
  })

  const onSubmit = (values: ResetPasswordInput) => {
    if (!code) return

    startTransition(async () => {
      const result = await updatePassword(values.password)
      if (result.ok) {
        toast.success(t('resetPassword.success'))
        router.push('/login')
        return
      }

      toast.error(t('errors.generic'), {
        description: result.message,
      })
    })
  }

  if (error) {
    return (
      <div className="text-center text-sm text-red-500">
        {error}
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push('/forgot-password')}>
            Request new link
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('resetPassword.password.label')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('resetPassword.password.placeholder')}
                    autoComplete="new-password"
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

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('resetPassword.confirmPassword.label')}</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('resetPassword.confirmPassword.placeholder')}
                  autoComplete="new-password"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending || !code}>
          {pending ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </Button>
      </form>
    </Form>
  )
}
