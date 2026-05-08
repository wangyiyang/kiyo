'use client'

import * as React from 'react'
import { useRouter, Link } from '@/i18n/navigation'
import { Button, Input, Label, Textarea } from '@kiyo/ui'
import { ArrowLeft, Wand2 } from 'lucide-react'

type CompositionMode = 'instrumental' | 'auto_lyrics' | 'existing_lyric'

const MODE_OPTIONS: { value: CompositionMode; label: string; emoji: string; description: string }[] = [
  { value: 'instrumental', label: '纯音乐', emoji: '\u{1F3B5}', description: '仅生成伴奏，无歌词' },
  { value: 'auto_lyrics', label: '自动写词', emoji: '\u{270D}\u{FE0F}', description: 'AI 自动生成歌词并作曲' },
  { value: 'existing_lyric', label: '已有歌词', emoji: '\u{1F4DD}', description: '使用已有歌词进行作曲' },
]

const LANGUAGE_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
]

export default function GenerateSongPage() {
  const router = useRouter()
  const [generating, setGenerating] = React.useState(false)
  const [prompt, setPrompt] = React.useState('')
  const [genre, setGenre] = React.useState('')
  const [mood, setMood] = React.useState('')
  const [language, setLanguage] = React.useState('')
  const [mode, setMode] = React.useState<CompositionMode>('auto_lyrics')
  const [lyrics, setLyrics] = React.useState<{ id: string; title: string }[]>([])
  const [lyricId, setLyricId] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    fetch('/api/lyrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.lyrics) setLyrics(data.lyrics)
      })
      .catch(() => {
        // 静默失败，用户仍可手动输入
      })
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('主题描述不能为空')
      return
    }
    if (mode === 'existing_lyric' && !lyricId) {
      setError('请选择关联歌词')
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
        setError(data.error?.message || '创作失败，请稍后重试')
      }
    } catch {
      setError('创作失败，请检查网络连接')
    } finally {
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
          返回列表
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">AI 作曲</h1>

      <div className="mb-6 space-y-6">
        {/* 主题描述 */}
        <div>
          <Label htmlFor="prompt">主题描述 *</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="描述你想要的音乐，如：一首关于夏天的流行歌曲"
            rows={3}
          />
        </div>

        {/* 风格和情绪 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="genre">风格（可选）</Label>
            <Input
              id="genre"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder="如：流行"
            />
          </div>
          <div>
            <Label htmlFor="mood">情绪（可选）</Label>
            <Input
              id="mood"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="如：欢快"
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
            className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 创作模式 */}
        <div>
          <Label className="mb-2 block">创作模式 *</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODE_OPTIONS.map((opt) => (
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
                <div className="mt-1 font-medium">{opt.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{opt.description}</div>
              </label>
            ))}
          </div>
        </div>

        {/* 关联歌词 — 条件显示 */}
        {mode === 'existing_lyric' && (
          <div>
            <Label htmlFor="lyric">关联歌词 *</Label>
            <select
              id="lyric"
              value={lyricId}
              onChange={(e) => setLyricId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">请选择歌词</option>
              {lyrics.map((lyric) => (
                <option key={lyric.id} value={lyric.id}>
                  {lyric.title}
                </option>
              ))}
            </select>
            {lyrics.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                暂无可选歌词，请先创建歌词
              </p>
            )}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline">取消</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating}>
          <Wand2 className="mr-1 h-4 w-4" />
          {generating ? '创作中...' : '开始创作'}
        </Button>
      </div>
    </div>
  )
}
