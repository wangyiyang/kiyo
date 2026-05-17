'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { Button, Input, Label } from '@kiyo/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kiyo/ui'
import { ArrowLeft, Mic2, Upload, Music } from 'lucide-react'
import { createBrowserClient } from '@kiyo/supabase'
import { useTranslations } from 'next-intl'

type SourceMode = 'existing' | 'upload'

export default function CoverSongPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()
  const t = useTranslations('songs.cover')
  const tCommon = useTranslations('common')

  const prefillSongId = searchParams.get('original_song_id')

  const [sourceMode, setSourceMode] = React.useState<SourceMode>(prefillSongId ? 'existing' : 'existing')
  const [selectedSongId, setSelectedSongId] = React.useState(prefillSongId || '')
  const [songs, setSongs] = React.useState<{ id: string; title: string; audio_url: string | null; file_path: string | null }[]>([])
  const [uploadedUrl, setUploadedUrl] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [selectedStyle, setSelectedStyle] = React.useState('')
  const [customTitle, setCustomTitle] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

  const hasAudioSource =
    sourceMode === 'existing'
      ? songs.some((s) => s.id === selectedSongId && (s.file_path || s.audio_url))
      : !!uploadedUrl

  const canSubmit = hasAudioSource && !!selectedStyle && !uploading

  const styleOptions = [
    { icon: '🎸', label: t('style.options.0.label'), prompt: t('style.options.0.prompt') },
    { icon: '🎷', label: t('style.options.1.label'), prompt: t('style.options.1.prompt') },
    { icon: '🎻', label: t('style.options.2.label'), prompt: t('style.options.2.prompt') },
    { icon: '🎹', label: t('style.options.3.label'), prompt: t('style.options.3.prompt') },
    { icon: '🎺', label: t('style.options.4.label'), prompt: t('style.options.4.prompt') },
    { icon: '🌙', label: t('style.options.5.label'), prompt: t('style.options.5.prompt') },
    { icon: '🤘', label: t('style.options.6.label'), prompt: t('style.options.6.prompt') },
    { icon: '🎤', label: t('style.options.7.label'), prompt: t('style.options.7.prompt') },
  ]

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('songs')
        .select('id, title, audio_url, file_path')
        .eq('user_id', user.id)
        .or('audio_url.not.is.null,file_path.not.is.null')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setSongs(data)
        })
    })
  }, [supabase])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      setError(tCommon('errors.fileTooLarge'))
      return
    }

    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError(tCommon('errors.unknown'))
      setUploading(false)
      return
    }

    const path = `audio-uploads/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('audio').upload(path, file, {
      contentType: file.type,
    })

    if (uploadError) {
      setError(tCommon('errors.uploadFailed', { message: uploadError.message }))
      setUploading(false)
      return
    }

    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
    setUploadedUrl(publicUrl.publicUrl)
    setUploading(false)
  }

  const handleGenerate = async () => {
    let audioUrl = ''
    if (sourceMode === 'existing') {
      const song = songs.find((s) => s.id === selectedSongId)
      if (song?.file_path) {
        try {
          const res = await fetch('/api/storage/sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bucket: 'audio', path: song.file_path }),
          })
          if (res.ok) {
            const data = await res.json()
            audioUrl = data.signedUrl
          }
        } catch {
          // fallback below
        }
      }
      if (!audioUrl && song?.audio_url) {
        audioUrl = song.audio_url
      }
    } else {
      audioUrl = uploadedUrl
    }

    if (!audioUrl) {
      setError(sourceMode === 'existing' ? t('error.noAudio') : t('error.noUpload'))
      return
    }

    if (!selectedStyle) {
      setError(t('error.noStyle'))
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await fetch('/api/songs/cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_style: selectedStyle,
          audio_url: audioUrl,
          original_song_id: sourceMode === 'existing' ? selectedSongId || null : null,
          title: customTitle.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.song) {
        router.push(`/songs/${data.song.id}`)
      } else {
        setError(data.error?.message || tCommon('errors.unknown'))
        setGenerating(false)
      }
    } catch {
      setError(tCommon('errors.network'))
      setGenerating(false)
    }
  }

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

      <div className="mb-6 space-y-4">
        {/* 参考音频区域 - 默认展开歌曲选择 */}
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">{t('source.label')}</Label>
          </div>

          <Tabs
            value={sourceMode}
            onValueChange={(v) => setSourceMode(v as SourceMode)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" className="gap-2">
                <Mic2 className="h-4 w-4" />
                {t('source.existing')}
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-2">
                <Upload className="h-4 w-4" />
                {t('source.upload')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="mt-4 space-y-3">
              <select
                id="song-select"
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">{t('selectSong')}</option>
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title}
                  </option>
                ))}
              </select>
              {songs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('error.noSongs')}
                </p>
              )}
            </TabsContent>

            <TabsContent value="upload" className="mt-4 space-y-2">
              <input
                id="audio-upload"
                type="file"
                accept="audio/mpeg,audio/wav,audio/flac"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              />
              {uploadedUrl && (
                <p className="text-sm text-green-600">{t('upload.success')}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('upload.formats')}
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Label>{t('style.label')} *</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {styleOptions.map((style) => (
              <button
                key={style.prompt}
                type="button"
                onClick={() => setSelectedStyle(style.prompt)}
                className={`rounded-lg border p-3 text-center transition-colors ${
                  selectedStyle === style.prompt
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="mb-1 text-2xl">{style.icon}</div>
                <div className="text-xs font-medium">{style.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="title">{t('titleLabel')}</Label>
          <Input
            id="title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline" disabled={generating}>{tCommon('actions.cancel')}</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating || !canSubmit}>
          {generating ? tCommon('states.generating') : t('submit')}
        </Button>
      </div>
    </div>
  )
}
