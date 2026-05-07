import { createServerClient } from '@kiyo/supabase'
import { EmptyState, SongRow } from '@kiyo/ui'
import Link from 'next/link'

export default async function SongsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">歌曲库</h1>
        <Link href="/albums" className="text-sm text-primary hover:underline">
          返回专辑列表
        </Link>
      </div>

      {songs && songs.length > 0 ? (
        <div className="space-y-2">
          {songs.map((song) => (
            <SongRow key={song.id} id={song.id} title={song.title} mode="drag" />
          ))}
        </div>
      ) : (
        <EmptyState title="暂无歌曲" description="去创作你的第一首歌曲吧" />
      )}
    </div>
  )
}
