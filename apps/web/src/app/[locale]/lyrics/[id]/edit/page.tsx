'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import {
  StructuredBlockEditor,
  textToBlocks,
  blocksToText,
  Button,
  Input,
  Label,
} from '@kiyo/ui'
import type { Block } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'
import { useTranslations } from 'next-intl'

export default function LyricEditPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const t = useTranslations('lyrics.edit')
  const tNew = useTranslations('lyrics.new')
  const tCommon = useTranslations('common')

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [blocks, setBlocks] = React.useState<Block[]>([])
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetch(`/api/lyrics/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.lyric) {
          setTitle(data.lyric.title)
          setLanguage(data.lyric.language ?? '')
          setStyle(data.lyric.style ?? '')
          setMood(data.lyric.mood ?? '')
          setBlocks(textToBlocks(data.lyric.content))
        } else {
          setError(tCommon('errors.notFound'))
        }
        setLoading(false)
      })
      .catch(() => {
        setError(tCommon('errors.loadFailed'))
        setLoading(false)
      })
  }, [params.id, tCommon])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const content = blocksToText(blocks)
      const res = await fetch(`/api/lyrics/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          language: language || undefined,
          style: style || undefined,
          mood: mood || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/lyrics/${params.id}`)
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
      <div className="container mx-auto max-w-3xl py-8">
        <div className="text-center text-muted-foreground">{tCommon('states.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl py-8">
        <div className="text-center text-destructive">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/lyrics/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

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
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">{tNew('fields.language')}</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder={tNew('placeholders.language')}
            />
          </div>
          <div>
            <Label htmlFor="style">{tNew('fields.style')}</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder={tNew('placeholders.style')}
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
      </div>

      <div className="mb-4">
        <Label className="mb-2 block">{t('contentLabel')}</Label>
        <StructuredBlockEditor blocks={blocks} onChange={setBlocks} />
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href={`/lyrics/${params.id}`}>
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
