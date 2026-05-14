'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function LyricGeneratePage() {
  const router = useRouter()
  const t = useTranslations('lyrics.generate')
  const tCommon = useTranslations('common')
  const tLocale = useTranslations('localeSwitcher')

  const [prompt, setPrompt] = React.useState('')
  const [language, setLanguage] = React.useState('zh')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

  const LANGUAGES = [
    { value: 'zh', label: tLocale('zh') },
    { value: 'en', label: tLocale('en') },
    { value: 'ja', label: tLocale('ja') },
    { value: 'ko', label: tLocale('ko') },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/lyrics/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.lyric) {
        router.push(`/lyrics/${data.lyric.id}/edit`)
      } else {
        setError(data.error?.message || t('error.failed'))
      }
    } catch {
      setError(t('error.network'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="prompt">{t('fields.prompt')} *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('placeholders.prompt')}
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{t('fields.language')}</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="style">{t('fields.style')}</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={t('placeholders.style')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/lyrics">
            <Button type="button" variant="outline">
              {tCommon('actions.cancel')}
            </Button>
          </Link>
          <Button type="submit" disabled={generating || !prompt.trim()}>
            {generating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                {tCommon('states.generating')}
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                {t('submit')}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
