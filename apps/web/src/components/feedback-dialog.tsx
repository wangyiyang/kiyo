'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { MessageSquare } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@kiyo/ui'

import { submitFeedback } from '@/app/actions/feedback'
import { feedbackSchema, type FeedbackInput } from '@/lib/schemas/feedback'

const typeOptions = ['bug', 'suggestion', 'other'] as const

export function FeedbackDialog() {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const t = useTranslations('feedback')

  const form = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { type: undefined, description: '', contact: '' },
    mode: 'onSubmit',
  })

  const onSubmit = (values: FeedbackInput) => {
    startTransition(async () => {
      const result = await submitFeedback(values)
      if (result.ok) {
        toast.success(t('success'))
        form.reset()
        setOpen(false)
        return
      }

      toast.error(result.message)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t('type.label')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type.label')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('type.placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {t(`type.options.${type}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('description.label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('description.placeholder')}
                      rows={4}
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
              name="contact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('contact.label')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('contact.placeholder')}
                      disabled={pending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}