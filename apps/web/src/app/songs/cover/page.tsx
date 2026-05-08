'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, Input, Label } from '@kiyo/ui'
import { ArrowLeft, Mic2, Upload } from 'lucide-react'
import Link from 'next/link'
import { createBrowserClient } from '@kiyo/supabase'

type SourceMode = 'existing' | 'upload'

const STYLE_OPTIONS = [
  { icon: '🎸', label: '流行摇滚版', prompt: '流行摇滚版，节奏更快，电吉他驱动' },
  { icon: '🎷', label: '爵士钢琴版', prompt: '爵士钢琴版，慵懒萨克斯，舒缓节奏' },
  { icon: '🎻', label: '民谣吉他版', prompt: '民谣吉他版，指弹吉他，亲密人声' },
  { icon: '🎹', label: '电子舞曲版', prompt: '电子舞曲版，强烈节拍，合成器铺底' },
  { icon: '🎺', label: '古典管弦版', prompt: '古典管弦版，弦乐编排，庄重氛围' },
  { icon: '🌙', label: 'Lo-fi 放松版', prompt: 'Lo-fi 放松版，黑胶噪点，梦幻氛围' },
  { icon: '🤘', label: '摇滚金属版', prompt: '摇滚金属版，失真吉他，强力鼓组' },
  { icon: '🎤', label: '灵魂乐版', prompt: '灵魂乐版，情感充沛，即兴唱腔' },
]

export default function CoverSongPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createBrowserClient()

  const prefillSongId = searchParams.get('original_song_id')

  const [sourceMode, setSourceMode] = React.useState<SourceMode>(prefillSongId ? 'existing' : 'existing')
  const [selectedSongId, setSelectedSongId] = React.useState(prefillSongId || '')
  const [songs, setSongs] = React.useState<{ id: string; title: string; audio_url: string | null }[]>([])
  const [uploadedUrl, setUploadedUrl] = React.useState('')
  const [uploading, setUploading] = React.useState(false)
  const [selectedStyle, setSelectedStyle] = React.useState('')
  const [customTitle, setCustomTitle] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('songs')
        .select('id, title, audio_url')
        .eq('user_id', user.id)
        .not('audio_url', 'is', null)
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
      setError('文件大小不能超过 50MB')
      return
    }

    setUploading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('请先登录')
      setUploading(false)
      return
    }

    const path = `audio-uploads/${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('audio').upload(path, file, {
      contentType: file.type,
    })

    if (uploadError) {
      setError(`上传失败: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: publicUrl } = supabase.storage.from('audio').getPublicUrl(path)
    setUploadedUrl(publicUrl.publicUrl)
    setUploading(false)
  }

  const handleGenerate = async () => {
    const audioUrl = sourceMode === 'existing'
      ? songs.find((s) => s.id === selectedSongId)?.audio_url || ''
      : uploadedUrl

    if (!audioUrl) {
      setError(sourceMode === 'existing' ? '请选择一首已有歌曲' : '请上传音频文件')
      return
    }

    if (!selectedStyle) {
      setError('请选择翻唱风格')
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
        setError(data.error?.message || '翻唱失败，请重试')
        setGenerating(false)
      }
    } catch {
      setError('翻唱失败，请重试')
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

      <h1 className="mb-6 text-2xl font-bold">AI 翻唱</h1>

      <div className="mb-6 space-y-4">
        {/* 来源选择 */}
        <div>
          <Label>参考音频来源</Label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setSourceMode('existing')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                sourceMode === 'existing'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Mic2 className="h-4 w-4" />
              选择已有歌曲
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                sourceMode === 'upload'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <Upload className="h-4 w-4" />
              上传音频
            </button>
          </div>
        </div>

        {/* 已有歌曲选择 */}
        {sourceMode === 'existing' && (
          <div>
            <Label htmlFor="song-select">选择歌曲</Label>
            <select
              id="song-select"
              value={selectedSongId}
              onChange={(e) => setSelectedSongId(e.target.value)}
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">请选择一首歌曲</option>
              {songs.map((song) => (
                <option key={song.id} value={song.id}>
                  {song.title}
                </option>
              ))}
            </select>
            {songs.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                暂无可用歌曲，请先创建并生成音乐
              </p>
            )}
          </div>
        )}

        {/* 文件上传 */}
        {sourceMode === 'upload' && (
          <div>
            <Label htmlFor="audio-upload">上传音频</Label>
            <input
              id="audio-upload"
              type="file"
              accept="audio/mpeg,audio/wav,audio/flac"
              onChange={handleFileUpload}
              disabled={uploading}
              className="mt-1 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
            />
            {uploadedUrl && (
              <p className="mt-1 text-xs text-green-600">音频已上传</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              支持 MP3、WAV、FLAC，最大 50MB
            </p>
          </div>
        )}

        {/* 风格选择 */}
        <div>
          <Label>翻唱风格 *</Label>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STYLE_OPTIONS.map((style) => (
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

        {/* 自定义标题 */}
        <div>
          <Label htmlFor="title">作品标题（可选）</Label>
          <Input
            id="title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="留空将自动生成标题"
          />
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3">
        <Link href="/songs">
          <Button variant="outline" disabled={generating}>取消</Button>
        </Link>
        <Button onClick={handleGenerate} disabled={generating || uploading}>
          {generating ? '翻唱中...' : '开始翻唱'}
        </Button>
      </div>
    </div>
  )
}
