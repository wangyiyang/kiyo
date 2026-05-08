'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'

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

import { sendResetPassword } from '@/app/actions/auth'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/schemas/auth'

export function ForgotPasswordForm() {
  const t = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [sent, setSent] = React.useState(false)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  })

  const onSubmit = (values: ForgotPasswordInput) => {
    startTransition(async () => {
      const result = await sendResetPassword(values.email)
      if (result.ok) {
        setSent(true)
        toast.success(t('forgotPassword.success'))
        return
      }

      toast.error(t('errors.generic'), {
        description: result.message,
      })
    })
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground">{t('forgotPassword.success')}</p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('forgotPassword.email.label')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t('forgotPassword.email.placeholder')}
                  autoComplete="email"
                  disabled={pending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>
      </form>
    </Form>
  )
}
