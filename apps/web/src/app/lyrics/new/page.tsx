'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function NewLyricPage() {
  const router = useRouter()
  const t = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError(t('error.empty'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/lyrics/${data.lyric.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.createFailed'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/lyrics"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">{t('fields.title')} *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('placeholders.title')}
            maxLength={200}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{t('fields.language')}</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder={t('placeholders.language')}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="style">{t('fields.style')}</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={t('placeholders.style')}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="mood">{t('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={t('placeholders.mood')}
              maxLength={100}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">{t('fields.content')} *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('placeholders.content')}
            rows={12}
            maxLength={10000}
            className="font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/lyrics">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? tCommon('states.saving') : tCommon('actions.save')}
        </Button>
      </div>
    </div>
  )
}
