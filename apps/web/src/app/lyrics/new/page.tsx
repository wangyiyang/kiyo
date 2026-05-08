'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Save } from 'lucide-react'

export default function NewLyricPage() {
  const router = useRouter()
  const [saving, setSaving] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [error, setError] = React.useState('')

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空')
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
        setError(data.error?.message || '创建失败')
      }
    } catch {
      setError('创建失败')
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
          返回列表
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">新建歌词</h1>

      <div className="mb-6 space-y-4">
        <div>
          <Label htmlFor="title">标题 *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="歌词标题"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">语言</Label>
            <Input
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="如：zh、en"
            />
          </div>
          <div>
            <Label htmlFor="style">风格</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="如：流行、摇滚"
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="如：励志、忧伤"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="content">内容 *</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="在此输入歌词内容，支持 [Verse]、[Chorus] 等标签..."
            rows={12}
            className="font-mono text-sm leading-relaxed"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/lyrics">
          <Button variant="outline">取消</Button>
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-1 h-4 w-4" />
          {saving ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}
