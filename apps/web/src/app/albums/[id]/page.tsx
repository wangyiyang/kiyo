import { createServerClient } from '@kiyo/supabase'
import { EmptyState } from '@kiyo/ui'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DraggableSongList } from '../_components/DraggableSongList'
import { CoverSection } from './_components/CoverSection'
import { AddSongsDialog } from './_components/AddSongsDialog'

interface AlbumDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AlbumDetailPage({ params }: AlbumDetailPageProps) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="container mx-auto py-8">请先登录</div>
  }

  const { data: album } = await supabase
    .from('albums')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!album) {
    notFound()
  }

  const { data: albumSongs } = await supabase
    .from('album_songs')
    .select('*, songs(*)')
    .eq('album_id', id)
    .order('order_index', { ascending: true })

  const songs = (albumSongs ?? []).map((as: any) => as.songs).filter(Boolean)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/albums" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回专辑列表
        </Link>
      </div>

      <CoverSection
        albumId={id}
        coverUrl={album.cover_url}
        coverStatus={album.cover_status}
        title={album.title}
      />

      <div className="mb-8">
        <h1 className="text-3xl font-bold">{album.title}</h1>
        {album.description && (
          <p className="mt-2 text-muted-foreground">{album.description}</p>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">歌曲列表</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{songs.length} 首歌曲</span>
          <AddSongsDialog albumId={id} excludeIds={songs.map((s: any) => s.id)} />
        </div>
      </div>

      {songs.length > 0 ? (
        <DraggableSongList
          songs={songs.map((s: any) => ({ id: s.id, title: s.title }))}
          albumId={id}
        />
      ) : (
        <EmptyState title="专辑暂无歌曲" description="编辑专辑添加歌曲" />
      )}
    </div>
  )
}
