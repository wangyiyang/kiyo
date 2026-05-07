'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'

import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@kiyo/ui'

import { joinWaitlist } from '@/app/actions/waitlist'
import { useWaitlist } from '@/lib/waitlist-context'
import { waitlistSchema, type WaitlistInput } from '@/lib/schemas/waitlist'

const roleKeys = ['producer', 'songwriter', 'enthusiast', 'other'] as const

export function WaitlistDialog() {
  const { open, setOpen, hide } = useWaitlist()
  const [pending, startTransition] = React.useTransition()
  const t = useTranslations('waitlist')

  const form = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: '', role: undefined },
    mode: 'onSubmit',
  })

  const onSubmit = (values: WaitlistInput) => {
    startTransition(async () => {
      const result = await joinWaitlist(values)
      if (result.ok) {
        toast.success(t('toast.success.title'), {
          description: t('toast.success.description'),
        })
        form.reset()
        hide()
        return
      }

      const description =
        result.code === 'DUPLICATE'
          ? t('toast.duplicate')
          : result.code === 'INVALID'
            ? t('toast.invalid')
            : t('toast.unknown')

      toast.error(result.message, { description })
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) form.reset()
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.email.label')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('fields.email.placeholder')}
                      autoComplete="email"
                      autoFocus
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.role.label')}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      {roleKeys.map((roleKey) => {
                        const active = field.value === roleKey
                        return (
                          <button
                            key={roleKey}
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              field.onChange(active ? undefined : roleKey)
                            }
                            className={cn(
                              'rounded-md border px-3 py-2 text-sm transition-colors',
                              active
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                            )}
                          >
                            {t(`fields.role.options.${roleKey}`)}
                          </button>
                        )
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={pending}
              >
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('actions.submitting') : t('actions.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
