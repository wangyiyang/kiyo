import { createServerClient } from '@kiyo/supabase/server'
import { redirect } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Music, FileText, Disc, Wand2, Mic2, Plus, ArrowRight } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@kiyo/ui'
import { RequireAuth } from '@/components/auth/require-auth'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  primary: number
  secondary: string
  href: string
  className?: string
}

function StatCard({ icon, label, primary, secondary, href, className = '' }: StatCardProps) {
  return (
    <Link href={href} className={`block rounded-xl border bg-card p-5 transition-shadow hover:shadow-md ${className}`}>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{primary}</p>
          <p className="text-sm text-muted-foreground">{secondary}</p>
        </div>
      </div>
    </Link>
  )
}

interface RecentItem {
  type: 'song' | 'lyric' | 'album'
  id: string
  title: string
  created_at: string
  status?: string
}

async function getStats() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [songsRes, lyricsRes, albumsRes] = await Promise.all([
    supabase.from('songs').select('status', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('lyrics').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('albums').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  ])

  const completedSongsRes = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  const generatingSongsRes = await supabase
    .from('songs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'generating')

  const composedLyricsRes = await supabase
    .from('songs')
    .select('lyric_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('lyric_id', 'is', null)

  return {
    songs: { 
      total: songsRes.count ?? 0, 
      completed: completedSongsRes.count ?? 0, 
      generating: generatingSongsRes.count ?? 0 
    },
    lyrics: { 
      total: lyricsRes.count ?? 0, 
      composed: composedLyricsRes.count ?? 0 
    },
    albums: { 
      total: albumsRes.count ?? 0 
    }
  }
}

async function getRecentItems() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const since = new Date()
  since.setDate(since.getDate() - 7)

  const [songs, lyrics, albums] = await Promise.all([
    supabase.from('songs').select('id, title, status, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3),
    supabase.from('lyrics').select('id, title, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3),
    supabase.from('albums').select('id, title, created_at').eq('user_id', user.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(3)
  ])

  const items = [
    ...(songs.data ?? []).map(s => ({ type: 'song' as const, ...s })),
    ...(lyrics.data ?? []).map(l => ({ type: 'lyric' as const, ...l })),
    ...(albums.data ?? []).map(a => ({ type: 'album' as const, ...a }))
  ]

  return items.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  }).slice(0, 6)
}

export default async function DashboardPage() {
  return (
    <RequireAuth redirectTo="/login?redirectTo=/dashboard">
      <DashboardContent />
    </RequireAuth>
  )
}

async function DashboardContent() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const t = await getTranslations('dashboard')
  const [stats, recentItems] = await Promise.all([getStats(), getRecentItems()])

  if (!stats) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 text-3xl font-bold">{t('title')}</h1>

          {/* Stats Grid */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Music className="h-6 w-6 text-primary" />}
              label={t('stats.songs.label')}
              primary={stats.songs.total}
              secondary={t('stats.songs.completed', { count: stats.songs.completed })}
              href="/songs"
            />
            <StatCard
              icon={<FileText className="h-6 w-6 text-primary" />}
              label={t('stats.lyrics.label')}
              primary={stats.lyrics.total}
              secondary={t('stats.lyrics.composed', { count: stats.lyrics.composed })}
              href="/lyrics"
            />
            <StatCard
              icon={<Disc className="h-6 w-6 text-primary" />}
              label={t('stats.albums.label')}
              primary={stats.albums.total}
              secondary={t('stats.albums.totalSongs', { count: 0 })}
              href="/albums"
            />
            <StatCard
              icon={<Wand2 className="h-6 w-6 text-purple-500" />}
              label={t('stats.generating.label')}
              primary={stats.songs.generating}
              secondary={t('stats.generating.description')}
              href="/songs?status=generating"
              className={stats.songs.generating > 0 ? 'border-purple-500/50 bg-purple-500/5' : ''}
            />
          </div>

          {/* Quick Actions */}
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold">{t('quickActions')}</h2>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/songs/new"><Wand2 className="mr-2 h-4 w-4" />{t('aiCompose')}</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/songs/cover"><Mic2 className="mr-2 h-4 w-4" />{t('aiCover')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/lyrics/new"><Plus className="mr-2 h-4 w-4" />{t('newLyric')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/albums/new"><Plus className="mr-2 h-4 w-4" />{t('newAlbum')}</Link>
              </Button>
            </div>
          </section>

          {/* Recent Projects */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t('recent.title')}</h2>
            </div>
            {recentItems.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentItems.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    href={item.type === 'song' ? `/songs/${item.id}` : item.type === 'lyric' ? `/lyrics/${item.id}` : `/albums/${item.id}`}
                    className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      {item.type === 'song' && <Music className="h-5 w-5 text-muted-foreground" />}
                      {item.type === 'lyric' && <FileText className="h-5 w-5 text-muted-foreground" />}
                      {item.type === 'album' && <Disc className="h-5 w-5 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground capitalize">{item.type}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">{t('recent.empty')}</p>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}