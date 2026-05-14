'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Save } from 'lucide-react'

import {
  Button,
  Input,
  Textarea,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@kiyo/ui'

import { getLyricCreateSchema, type LyricCreateInput } from '@/lib/schemas/lyrics'

interface LyricCreateFormProps {
  onSuccess: (lyricId: string) => void
}

export function LyricCreateForm({ onSuccess }: LyricCreateFormProps) {
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  const schema = React.useMemo(() => getLyricCreateSchema((key) => t(key)), [t])

  const form = useForm<LyricCreateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      content: '',
      language: '',
      style: '',
      mood: '',
    },
    mode: 'onSubmit',
  })

  const handleSave = async (values: LyricCreateInput) => {
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          content: values.content.trim(),
          language: values.language || undefined,
          style: values.style || undefined,
          mood: values.mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.lyric.id)
      } else {
        const errorMap: Record<string, string> = {
          UNAUTHORIZED: tCommon('errors.unauthorized'),
          VALIDATION_ERROR: tCommon('errors.validationError'),
        }
        form.setError('root', {
          message:
            errorMap[data.error?.code] ||
            tCommon('errors.createFailed'),
        })
      }
    } catch {
      form.setError('root', { message: tCommon('errors.network') })
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSave)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.title')} *
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={t('placeholders.title')}
                  maxLength={200}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.language')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.language')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="style"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.style')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.style')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.mood')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('placeholders.mood')}
                    maxLength={100}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {t('fields.content')} *
              </FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('placeholders.content')}
                  rows={12}
                  maxLength={10000}
                  className="font-mono text-sm leading-relaxed"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Save className="mr-1 h-4 w-4" />
            {form.formState.isSubmitting
              ? tCommon('states.saving')
              : tCommon('actions.save')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
