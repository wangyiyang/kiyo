import { createServerClient } from '@kiyo/supabase'
import Link from 'next/link'
import { AudioPlayer, Button, SongStatusBadge } from '@kiyo/ui'
import { ArrowLeft, Pencil, Play, AlertCircle } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function SongDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: song } = await supabase
    .from('songs')
    .select('*, lyrics(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!song) {
    notFound()
  }

  const formatDuration = (seconds?: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="container mx-auto max-w-3xl py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/songs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{song.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <SongStatusBadge status={song.status} />
            {song.genre && <span>{song.genre}</span>}
            {song.mood && <span>{song.mood}</span>}
            {song.duration && (
              <span className="flex items-center gap-1">
                <Play className="h-3 w-3" />
                {formatDuration(song.duration)}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                song.source === 'ai_generated'
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {song.source === 'ai_generated' ? 'AI 生成' : '手动创建'}
            </span>
          </div>
        </div>
        <Link href={`/songs/${song.id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-4 w-4" />
            编辑
          </Button>
        </Link>
      </div>

      {(song.status === 'draft' || song.status === 'failed') && (
        <div className="mb-6 rounded-lg border border-dashed p-6 text-center">
          <div className="mb-2 flex justify-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-2 text-sm text-muted-foreground">
            {song.status === 'failed'
              ? '音乐生成失败，请检查后重试'
              : '歌曲尚未生成音乐'}
          </p>
          <form
            action={`/api/songs/${song.id}/generate`}
            method="POST"
          >
            <Button type="submit" disabled={!song.lyric_id}>
              {song.status === 'failed' ? '重新生成' : '生成音乐'}
            </Button>
          </form>
          {!song.lyric_id && (
            <p className="mt-2 text-xs text-muted-foreground">
              需要关联歌词后才能生成音乐
            </p>
          )}
        </div>
      )}

      {song.status === 'generating' && (
        <div className="mb-6 rounded-lg border p-6 text-center">
          <p className="text-sm text-muted-foreground">音乐生成中，请稍候...</p>
        </div>
      )}

      {song.status === 'completed' && song.audio_url && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium">音频预览</h2>
          <AudioPlayer src={song.audio_url} className="w-full" />
        </div>
      )}

      {song.ai_prompt && (
        <div className="mb-6">
          <h2 className="mb-1 text-sm font-medium">生成描述</h2>
          <p className="text-sm text-muted-foreground">{song.ai_prompt}</p>
        </div>
      )}

      {song.lyrics && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium">歌词</h2>
            <Link href={`/lyrics/${song.lyrics.id}`} className="text-xs text-primary hover:underline">
              查看完整歌词
            </Link>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
              {song.lyrics.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
