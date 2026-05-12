'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'

import {
  Button,
  Checkbox,
  Input,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Separator,
  toast,
} from '@kiyo/ui'

import { signUp } from '@/app/actions/auth'
import { registerSchema, type RegisterInput } from '@/lib/schemas/auth'
import { Link } from '@/i18n/navigation'
import { OAuthButtons } from './oauth-buttons'

function getPasswordStrength(password: string): number {
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.min(score, 4)
}

function strengthLabel(score: number): { key: string; color: string } {
  switch (score) {
    case 0:
    case 1:
      return { key: 'weak', color: 'bg-red-500' }
    case 2:
      return { key: 'fair', color: 'bg-yellow-500' }
    case 3:
      return { key: 'good', color: 'bg-blue-500' }
    case 4:
      return { key: 'strong', color: 'bg-green-500' }
    default:
      return { key: 'weak', color: 'bg-red-500' }
  }
}

export function RegisterForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', termsAccepted: false },
    mode: 'onBlur',
  })

  const password = form.watch('password')
  const strength = getPasswordStrength(password)
  const { key: strengthKey, color } = strengthLabel(strength)

  const onSubmit = (values: RegisterInput) => {
    startTransition(async () => {
      const result = await signUp(values.email, values.password)
      if (result.ok) {
        toast.success(t('register.title'), {
          description: t('register.success'),
        })
        router.push('/login')
        return
      }

      toast.error(t('errors.generic'), {
        description: result.message,
      })
    })
  }

  return (
    <div className="space-y-4">
      <OAuthButtons />
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">或</span>
        <Separator className="flex-1" />
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('register.email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('register.email.placeholder')}
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
              <FormLabel>{t('register.password.label')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('register.password.placeholder')}
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
              {password.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${color}`}
                      style={{ width: `${((strength + 1) / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('register.passwordStrength.label')}: {t(`register.passwordStrength.${strengthKey}`)}
                  </p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('register.confirmPassword.label')}</FormLabel>
              <FormControl>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('register.confirmPassword.placeholder')}
                  autoComplete="new-password"
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
          name="termsAccepted"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-normal cursor-pointer">
                  I have read and agree to the{' '}
                  <Link href="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/terms" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('register.submitting') : t('register.submit')}
        </Button>
        </form>
      </Form>
    </div>
  )
}
