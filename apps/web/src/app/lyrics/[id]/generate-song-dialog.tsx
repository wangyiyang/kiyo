'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
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

const LANGUAGE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
]

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
  const [open, setOpen] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState(lyricTitle)
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState(lyricLanguage ?? '')
  const [error, setError] = React.useState('')

  const contentEmpty = !lyricContent || lyricContent.trim() === ''

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('主题描述不能为空')
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
        setError(data.error?.message || '生成失败，请稍后重试')
      }
    } catch {
      setError('生成失败，请检查网络连接')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Music className="mr-1 h-4 w-4" />
        生成音乐
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>基于此歌词生成音乐</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {contentEmpty && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              歌词内容为空，无法生成音乐
            </p>
          )}

          {/* 主题描述 */}
          <div>
            <Label htmlFor="prompt">主题描述 *</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要的音乐"
              rows={2}
              disabled={generating || contentEmpty}
            />
          </div>

          {/* 风格 + 情绪 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="genre">风格（可选）</Label>
              <Input
                id="genre"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="如：流行"
                disabled={generating || contentEmpty}
              />
            </div>
            <div>
              <Label htmlFor="mood">情绪（可选）</Label>
              <Input
                id="mood"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="如：欢快"
                disabled={generating || contentEmpty}
              />
            </div>
          </div>

          {/* 语言 */}
          <div>
            <Label htmlFor="language">语言（可选）</Label>
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

          {/* 歌词预览 */}
          <div>
            <Label>歌词预览</Label>
            <div className="mt-1 max-h-24 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
              {lyricContent.length > 200
                ? lyricContent.slice(0, 200) + '...'
                : lyricContent || '（无内容）'}
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
            取消
          </Button>
          <Button onClick={handleGenerate} disabled={generating || contentEmpty}>
            {generating ? '生成中...' : '开始生成'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
