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

const updateEmailSchema = z.object({
  newEmail: z.string().email('Please enter a valid email'),
  currentPassword: z.string().min(1, 'Current password is required'),
})

type UpdateEmailInput = z.infer<typeof updateEmailSchema>

export function UpdateEmailForm() {
  const t = useTranslations('settings')
  const authT = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [showPassword, setShowPassword] = React.useState(false)

  const form = useForm<UpdateEmailInput>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: {
      newEmail: '',
      currentPassword: '',
    },
  })

  const onSubmit = (values: UpdateEmailInput) => {
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
          description: t('emailSection.currentPasswordIncorrect'),
        })
        return
      }

      const { error } = await supabase.auth.updateUser({
        email: values.newEmail,
      })

      if (error) {
        toast.error(authT('errors.generic'), {
          description: error.message,
        })
        return
      }

      toast.success(t('emailSection.success'))
      form.reset()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="newEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('emailSection.newEmail')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
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
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('emailSection.currentPassword')}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    disabled={pending}
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
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

        <Button type="submit" disabled={pending}>
          {pending ? 'Updating...' : t('emailSection.submit')}
        </Button>
      </form>
    </Form>
  )
}
