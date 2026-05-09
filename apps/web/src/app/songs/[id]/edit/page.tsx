'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function SongEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const t = useTranslations('songs.edit')
  const tNew = useTranslations('songs.new')
  const tCommon = useTranslations('common')

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [aiPrompt, setAiPrompt] = React.useState('')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [selectedLyricId, setSelectedLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/songs/${params.id}`).then((res) => res.json()),
      fetch('/api/lyrics').then((res) => res.json()),
    ])
      .then(([songData, lyricsData]) => {
        if (songData.song) {
          setTitle(songData.song.title)
          setGenre(songData.song.genre ?? '')
          setMood(songData.song.mood ?? '')
          setAiPrompt(songData.song.ai_prompt ?? '')
          setSelectedLyricId(songData.song.lyric_id ?? '')
        } else {
          setError(tCommon('errors.notFound'))
        }
        if (lyricsData.lyrics) setLyrics(lyricsData.lyrics)
        setLoading(false)
      })
      .catch(() => {
        setError(tCommon('errors.loadFailed'))
        setLoading(false)
      })
  }, [params.id])

  const handleSave = async () => {
    if (!title.trim()) {
      setError(tNew('error.emptyTitle'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/songs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          genre: genre || undefined,
          mood: mood || undefined,
          ai_prompt: aiPrompt || undefined,
          lyric_id: selectedLyricId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/songs/${params.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.saveFailed'))
      }
    } catch {
      setError(tCommon('errors.network'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-muted-foreground">{tCommon('states.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/songs/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">{tNew('fields.title')}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tNew('placeholders.title')}
          />
        </div>

        <div>
          <Label htmlFor="lyric">{tNew('fields.lyric')}（{tCommon('actions.optional')}）</Label>
          <select
            id="lyric"
            value={selectedLyricId}
            onChange={(e) => setSelectedLyricId(e.target.value)}
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">{tNew('fields.noLyric')}</option>
            {lyrics.map((lyric) => (
              <option key={lyric.id} value={lyric.id}>
                {lyric.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">{tNew('fields.genre')}</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={tNew('placeholders.genre')}
            />
          </div>
          <div>
            <Label htmlFor="mood">{tNew('fields.mood')}</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder={tNew('placeholders.mood')}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="aiPrompt">{tNew('fields.aiPrompt')}</Label>
          <Textarea
            id="aiPrompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={tNew('placeholders.aiPrompt')}
            rows={3}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href={`/songs/${params.id}`}>
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
