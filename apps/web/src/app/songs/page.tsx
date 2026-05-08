import { createServerClient } from '@kiyo/supabase'
import { EmptyState, SongCard } from '@kiyo/ui'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*, lyrics(title, id)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">歌曲库</h1>
        <Link
          href="/songs/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建歌曲
        </Link>
      </div>

      {songs && songs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <SongCard
              key={song.id}
              id={song.id}
              title={song.title}
              status={song.status}
              duration={song.duration}
              lyricTitle={song.lyrics?.title ?? null}
              coverUrl={song.cover_url}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无歌曲" description="创建你的第一首歌曲吧" />
      )}
    </div>
  )
}
