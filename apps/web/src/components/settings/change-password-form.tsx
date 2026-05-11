'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { z } from 'zod'

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

import { createBrowserClient } from '@kiyo/supabase'
import { signInWithPassword } from '@/app/actions/auth'

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

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  })

type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export function ChangePasswordForm() {
  const t = useTranslations('settings')
  const authT = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
  const [showNewPassword, setShowNewPassword] = React.useState(false)

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  })

  const newPassword = form.watch('newPassword')
  const strength = getPasswordStrength(newPassword)
  const strengthInfo = strengthLabel(strength)

  const onSubmit = (values: ChangePasswordInput) => {
    startTransition(async () => {
      const supabase = createBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user?.email) {
        toast.error(authT('errors.generic'))
        return
      }

      const verifyResult = await signInWithPassword(user.email, values.currentPassword)
      if (!verifyResult.ok) {
        toast.error(authT('errors.generic'), {
          description: t('passwordSection.currentPasswordIncorrect'),
        })
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      })

      if (error) {
        toast.error(authT('errors.generic'), {
          description: error.message,
        })
        return
      }

      toast.success(t('passwordSection.success'))
      form.reset()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordSection.currentPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('passwordSection.newPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </FormControl>
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${
                          i < strength ? strengthInfo.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {authT(`register.passwordStrength.${strengthInfo.key}`)}
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
              <FormLabel>{t('passwordSection.confirmPassword')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Updating...' : t('passwordSection.submit')}
        </Button>
      </form>
    </Form>
  )
}
