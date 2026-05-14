import { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { createServerClient } from "@kiyo/supabase/server"
import { cn } from "@kiyo/ui"
import { Link } from "@/i18n/navigation"
import { ScrollReveal } from "@/components/scroll-reveal"
import { ExploreSongGrid } from "@/components/explore-song-grid"

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; mood?: string }>
}) {
  const t = await getTranslations("explore")
  const { genre, mood } = await searchParams

  const supabase = await createServerClient()

  // Query: Get all genre and mood options from all songs
  const { data: allSongs } = await supabase
    .from("songs")
    .select("genre, mood")
    .eq("is_public", true)

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
    return `/explore${qs ? `?${qs}` : ""}`
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        {/* Header */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background pt-24 pb-16">
          <div className="container mx-auto px-4">
            <ScrollReveal>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {t("title")}
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                {t("description")}
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Filters */}
        <section className="container mx-auto px-4 py-8">
          {/* Genre filter */}
          <ScrollReveal delay={0.1}>
            <div className="mb-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t("filters.genre")}</h3>
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
                  {t("filters.all")}
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
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">{t("filters.mood")}</h3>
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
                  {t("filters.all")}
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
          <ExploreSongGrid genre={genre} mood={mood} />
        </section>
      </main>
    </div>
  )
}
