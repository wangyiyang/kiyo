import { Metadata } from "next"
import { createServerClient } from "@kiyo/supabase/server"
import { EmptyState, cn } from "@kiyo/ui"
import { Link } from "@/i18n/navigation"
import { ShowcaseCard } from "@/components/sections/showcase-card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: "探索歌曲",
  description: "发现 AI 生成的精选音乐作品",
}

interface FeaturedTrack {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  audio_url: string | null
  duration: number | null
}

const trackGradients = [
  "from-indigo-500 to-cyan-400",
  "from-amber-400 to-pink-400",
  "from-rose-500 to-violet-500",
  "from-sky-500 to-emerald-400",
  "from-fuchsia-500 to-orange-400",
  "from-purple-400 to-pink-300",
]

export default async function ExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ genre?: string; mood?: string }>
}) {
  const { locale } = await params
  const { genre, mood } = await searchParams

  const supabase = await createServerClient()

  // Query 1: Get all songs (with optional filters)
  let query = supabase
    .from("songs")
    .select("id, title, genre, mood, cover_url, audio_url, duration")

  if (genre) {
    query = query.eq("genre", genre)
  }
  if (mood) {
    query = query.eq("mood", mood)
  }

  const { data: songs, error } = await query.order("created_at", { ascending: false })

  if (error) {
    console.error("Error fetching songs:", error)
  }

  // Sort: songs with cover first, then by created_at desc
  const sortedSongs = (songs ?? []).sort((a: any, b: any) => {
    const aHasCover = a.cover_url ? 1 : 0
    const bHasCover = b.cover_url ? 1 : 0
    return bHasCover - aHasCover
  })

  // Query 2: Get all genre and mood options from all songs
  const { data: allSongs } = await supabase
    .from("songs")
    .select("genre, mood")

  const genres = Array.from(
    new Set(allSongs?.map((s) => s.genre).filter(Boolean) as string[])
  ).sort()

  const moods = Array.from(
    new Set(allSongs?.map((s) => s.mood).filter(Boolean) as string[])
  ).sort()

  const buildUrl = (g?: string, m?: string) => {
    const sp = new URLSearchParams()
    if (g) sp.set("genre", g)
    if (m) sp.set("mood", m)
    const qs = sp.toString()
    return `/${locale}/explore${qs ? `?${qs}` : ""}`
  }

  const tracks: FeaturedTrack[] = sortedSongs

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background pt-24 pb-16">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                探索歌曲
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                发现 AI 生成的精选音乐作品
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Filters */}
        <section className="container mx-auto px-4 py-8">
          {/* Genre filter */}
          <ScrollReveal delay={0.1}>
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">风格</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildUrl(undefined, mood)}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    !genre
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  全部
                </Link>
                {genres.map((g) => (
                  <Link
                    key={g}
                    href={buildUrl(g, mood)}
                    className={cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      genre === g
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {g}
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Mood filter */}
          <ScrollReveal delay={0.2}>
            <div className="mb-8">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">情绪</h3>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={buildUrl(genre, undefined)}
                  className={cn(
                    "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    !mood
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  全部
                </Link>
                {moods.map((m) => (
                  <Link
                    key={m}
                    href={buildUrl(genre, m)}
                    className={cn(
                      "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      mood === m
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                  >
                    {m}
                  </Link>
                ))}
              </div>
            </div>
          </ScrollReveal>

          {/* Songs Grid */}
          {tracks.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tracks.map((track, index) => (
                <ScrollReveal key={track.id} delay={(index % 3) * 0.08}>
                  <ShowcaseCard
                    track={track}
                    index={index}
                    playlist={tracks}
                    gradient={trackGradients[index % trackGradients.length]}
                  />
                </ScrollReveal>
              ))}
            </div>
          ) : (
            <ScrollReveal>
              <EmptyState
                title="暂无歌曲"
                description="当前筛选条件下没有找到歌曲，试试其他筛选条件吧"
              />
            </ScrollReveal>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
