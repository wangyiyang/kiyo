'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

type CompositionMode = 'instrumental' | 'auto_lyrics' | 'existing_lyric'

export default function NewSongPage() {
  const router = useRouter()
  const t = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [mode, setMode] = React.useState<CompositionMode>('auto_lyrics')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [lyricId, setLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  const LANGUAGE_OPTIONS = [
    { value: '', label: t('languageUnlimited') },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
  ]

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // silently fail
      })
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError(t('error.emptyPrompt'))
      return
    }
    if (mode === 'existing_lyric' && !lyricId) {
      setError(t('error.noLyricSelected'))
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
          genre: genre || undefined,
          mood: mood || undefined,
          language: language || undefined,
          mode,
          lyric_id: mode === 'existing_lyric' ? lyricId : undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
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

  const modeOptions: { value: CompositionMode; labelKey: string; descKey: string; emoji: string }[] = [
    { value: 'instrumental', labelKey: 'mode.instrumental.label', descKey: 'mode.instrumental.desc', emoji: '🎵' },
    { value: 'auto_lyrics', labelKey: 'mode.auto_lyrics.label', descKey: 'mode.auto_lyrics.desc', emoji: '✍️' },
    { value: 'existing_lyric', labelKey: 'mode.existing_lyric.label', descKey: 'mode.existing_lyric.desc', emoji: '📝' },
  ]

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon('actions.back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-6">
        <div>
          <Label htmlFor="prompt">{t('fields.prompt')} *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('placeholders.prompt')}
            rows={3}
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

        <div>
          <Label htmlFor="language">{t('fields.language')}</Label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
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
          <Label className="mb-2 block">{t('fields.mode')} *</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {modeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                  mode === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                />
                <div className="text-lg">{opt.emoji}</div>
                <div className="mt-1 font-medium">{t(opt.labelKey as any)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t(opt.descKey as any)}</div>
              </label>
            ))}
          </div>
        </div>

        {mode === 'existing_lyric' && (
          <div>
            <Label htmlFor="lyric">{t('selectLyric')} *</Label>
            <select
              id="lyric"
              value={lyricId}
              onChange={(e) => setLyricId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t('selectLyric')}</option>
              {lyrics.map((lyric) => (
                <option key={lyric.id} value={lyric.id}>
                  {lyric.title}
                </option>
              ))}
            </select>
            {lyrics.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('noLyrics')}
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline">{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating}>
          <Wand2 className="mr-1 h-4 w-4" />
          {generating ? tCommon('states.generating') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
