'use client'

import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@kiyo/ui'
import { Music } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface GenerateSongDialogProps {
  lyricId: string
  lyricTitle: string
  lyricContent: string
  lyricLanguage: string | null
}

export function GenerateSongDialog({
  lyricId,
  lyricTitle,
  lyricContent,
  lyricLanguage,
}: GenerateSongDialogProps) {
  const router = useRouter()
  const t = useTranslations('lyrics.generateSong')
  const tCommon = useTranslations('common')

  const [open, setOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState(lyricTitle)
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState(lyricLanguage ?? '')
  const [error, setError] = React.useState('')

  const contentEmpty = !lyricContent || lyricContent.trim() === ''

  const LANGUAGE_OPTIONS = [
    { value: '', label: tCommon('actions.optional') },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ]

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(tCommon('errors.required'))
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          mode: 'existing_lyric',
          lyric_id: lyricId,
          genre: genre || undefined,
          mood: mood || undefined,
          language: language || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.song) {
        setOpen(false)
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.unknown'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Music className="mr-1 h-4 w-4" />
        {t('submit')}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {contentEmpty && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              {t('emptyWarning')}
            </p>
          )}

          <div>
            <Label htmlFor="prompt">{t('fields.prompt')} *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('placeholders.prompt')}
              rows={2}
              disabled={generating || contentEmpty}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genre">{t('fields.genre')}</Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder={t('placeholders.genre')}
                disabled={generating || contentEmpty}
              />
            </div>
            <div>
              <Label htmlFor="mood">{t('fields.mood')}</Label>
              <Input
                id="mood"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder={t('placeholders.mood')}
                disabled={generating || contentEmpty}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="language">{t('fields.language')}</Label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={generating || contentEmpty}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>{t('preview')}</Label>
            <div className="mt-1 max-h-24 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              {lyricContent.length > 200
                ? lyricContent.slice(0, 200) + '...'
                : lyricContent || t('noContent')}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={generating}
          >
            {tCommon('actions.cancel')}
          </Button>
          <Button onClick={handleGenerate} disabled={generating || contentEmpty}>
            {generating ? tCommon('states.generating') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
