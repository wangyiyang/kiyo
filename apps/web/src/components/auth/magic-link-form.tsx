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

import { sendMagicLink } from '@/app/actions/auth'
import { getMagicLinkSchema, type MagicLinkInput } from '@/lib/schemas/auth'

interface MagicLinkFormProps {
  onBack: () => void
}

export function MagicLinkForm({ onBack }: MagicLinkFormProps) {
  const t = useTranslations('auth')
  const [pending, startTransition] = React.useTransition()
  const [sent, setSent] = React.useState(false)

  const schema = getMagicLinkSchema((key) => t(key))
  const form = useForm<MagicLinkInput>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  })

  const onSubmit = (values: MagicLinkInput) => {
    startTransition(async () => {
      const result = await sendMagicLink(values.email)
      if (result.ok) {
        setSent(true)
        toast.success(t('login.magicLink.success'))
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
        <p className="text-muted-foreground">{t('login.magicLink.success')}</p>
        <Button variant="outline" onClick={onBack} className="w-full">
          {t('login.magicLink.backToPassword')}
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('login.magicLink.description')}
        </p>

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

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('login.magicLink.submitting') : t('login.magicLink.submit')}
        </Button>

        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {t('login.magicLink.backToPassword')}
        </button>
      </form>
    </Form>
  )
}
