'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react'
import Link from 'next/link'

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
]

export default function LyricGeneratePage() {
  const router = useRouter()
  const [prompt, setPrompt] = React.useState('')
  const [language, setLanguage] = React.useState('zh')
  const [style, setStyle] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

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
        setError(data.error?.message || '生成失败，请稍后重试')
      }
    } catch {
      setError('生成失败，请检查网络后重试')
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
          返回列表
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 生成歌词</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          描述你想要的歌曲主题，AI 将为你创作完整歌词
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="prompt">主题描述 *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：一首关于青春校园的励志歌曲"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="language">语言</Label>
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
            <Label htmlFor="style">风格</Label>
            <Input
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="流行、摇滚..."
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="励志、忧伤..."
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
              取消
            </Button>
          </Link>
          <Button type="submit" disabled={generating || !prompt.trim()}>
            {generating ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="mr-1 h-4 w-4" />
                生成歌词
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
