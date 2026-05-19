'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { Wand2 } from 'lucide-react'

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

import { getSongCreateSchema, type SongCreateInput } from '@/lib/schemas/songs'

interface SongCreateFormProps {
  lyrics: { id: string; title: string }[]
  onSuccess: (songId: string) => void
}

const LANGUAGE_OPTIONS = [
  { value: '', labelKey: 'languageUnlimited' },
  { value: 'zh', labelKey: 'zh' },
  { value: 'en', labelKey: 'en' },
  { value: 'ja', labelKey: 'ja' },
]

/* ── 子组件 ── */

interface ModeSelectorProps {
  value: SongCreateInput['mode'] | undefined
  onChange: (v: SongCreateInput['mode']) => void
  t: ReturnType<typeof useTranslations>
}

const MODE_OPTIONS: {
  value: SongCreateInput['mode']
  labelKey: string
  descKey: string
  emoji: '🎵' | '✍️' | '📝'
}[] = [
  { value: 'instrumental', labelKey: 'mode.instrumental.label', descKey: 'mode.instrumental.desc', emoji: '🎵' },
  { value: 'auto_lyrics', labelKey: 'mode.auto_lyrics.label', descKey: 'mode.auto_lyrics.desc', emoji: '✍️' },
  { value: 'existing_lyric', labelKey: 'mode.existing_lyric.label', descKey: 'mode.existing_lyric.desc', emoji: '📝' },
]

function ModeSelector({ value, onChange, t }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {MODE_OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`cursor-pointer rounded-lg border p-4 transition-colors ${
            value === opt.value
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
          }`}
        >
          <input
            type="radio"
            name="mode"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="sr-only"
          />
          <div className="text-lg">{opt.emoji}</div>
          <div className="mt-1 font-medium">{t(opt.labelKey)}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t(opt.descKey)}</div>
        </label>
      ))}
    </div>
  )
}

interface LyricSelectProps {
  value: string
  onChange: (v: string) => void
  lyrics: { id: string; title: string }[]
  t: ReturnType<typeof useTranslations>
}

function LyricSelect({ value, onChange, lyrics, t }: LyricSelectProps) {
  return (
    <FormItem>
      <FormLabel>{t('selectLyric')} *</FormLabel>
      <FormControl>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t('selectLyric')}</option>
          {lyrics.map((lyric) => (
            <option key={lyric.id} value={lyric.id}>
              {lyric.title}
            </option>
          ))}
        </select>
      </FormControl>
      {lyrics.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{t('noLyrics')}</p>
      )}
      <FormMessage />
    </FormItem>
  )
}

function LanguageSelect({
  value,
  onChange,
  t,
  tLocale,
}: {
  value: string | undefined
  onChange: (v: string) => void
  t: ReturnType<typeof useTranslations>
  tLocale: ReturnType<typeof useTranslations>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
    >
      {LANGUAGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.value === '' ? t(opt.labelKey) : tLocale(opt.labelKey)}
        </option>
      ))}
    </select>
  )
}

/* ── 主组件 ── */

export function SongCreateForm({ lyrics, onSuccess }: SongCreateFormProps) {
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')
  const tLocale = useTranslations('localeSwitcher')

  const schema = React.useMemo(() => getSongCreateSchema((key) => t(key)), [t])

  const form = useForm<SongCreateInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      prompt: '',
      genre: '',
      mood: '',
      language: '',
      mode: 'auto_lyrics',
      lyricId: '',
    },
    mode: 'onSubmit',
  })

  const mode = form.watch('mode')

  const handleGenerate = async (values: SongCreateInput) => {
    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.title.trim(),
          prompt: values.prompt.trim(),
          genre: values.genre || undefined,
          mood: values.mood || undefined,
          language: values.language || undefined,
          mode: values.mode,
          lyric_id: values.mode === 'existing_lyric' ? values.lyricId : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(data.song.id)
      } else {
        const errorMap: Record<string, string> = {
          UNAUTHORIZED: tCommon('errors.unauthorized'),
          VALIDATION_ERROR: tCommon('errors.validationError'),
        }
        form.setError('root', {
          message: errorMap[data.error?.code] || data.error?.message || tCommon('errors.unknown'),
        })
      }
    } catch {
      form.setError('root', { message: tCommon('errors.network') })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.title')} *</FormLabel>
              <FormControl>
                <Input placeholder={t('placeholders.title')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.prompt')} *</FormLabel>
              <FormControl>
                <Textarea placeholder={t('placeholders.prompt')} rows={3} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="genre"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('fields.genre')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('placeholders.genre')} {...field} />
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
                  <Input placeholder={t('placeholders.mood')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.language')}</FormLabel>
              <FormControl>
                <LanguageSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  t={t}
                  tLocale={tLocale}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-2 block">{t('fields.mode')} *</FormLabel>
              <FormControl>
                <ModeSelector
                  value={field.value}
                  onChange={field.onChange}
                  t={t}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === 'existing_lyric' && (
          <FormField
            control={form.control}
            name="lyricId"
            render={({ field }) => (
              <LyricSelect
                value={field.value ?? ''}
                onChange={field.onChange}
                lyrics={lyrics}
                t={t}
              />
            )}
          />
        )}

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            <Wand2 className="mr-1 h-4 w-4" />
            {form.formState.isSubmitting ? tCommon('states.generating') : t('submit')}
          </Button>
        </div>
      </form>
    </Form>
  )
}