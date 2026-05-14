import { getTranslations } from "next-intl/server"
import { createServerClient } from "@kiyo/supabase/server"
import { Button, Input, cn } from "@kiyo/ui"
import { Search, X } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { ScrollReveal } from "@/components/scroll-reveal"
import { ExploreSongGrid } from "@/components/explore-song-grid"

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; mood?: string; q?: string }>
}) {
  const t = await getTranslations("explore")
  const { genre, mood, q } = await searchParams
  const query = q?.trim() || undefined

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

  const buildUrl = (g?: string, m?: string, search: string | null | undefined = query) => {
    const sp = new URLSearchParams()
    if (g) sp.set("genre", g)
    if (m) sp.set("mood", m)
    if (search) sp.set("q", search)
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
          <ScrollReveal delay={0.05}>
            <form action="/explore" method="get" className="mb-8">
              {genre && <input type="hidden" name="genre" value={genre} />}
              {mood && <input type="hidden" name="mood" value={mood} />}
              <label htmlFor="explore-search" className="sr-only">
                {t("search.label")}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="explore-search"
                    name="q"
                    defaultValue={query}
                    placeholder={t("search.placeholder")}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="icon" aria-label={t("search.submit")}>
                    <Search className="h-4 w-4" />
                  </Button>
                  {query && (
                    <Button variant="outline" size="icon" asChild>
                      <Link href={buildUrl(genre, mood, null)} aria-label={t("search.clear")}>
                        <X className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </ScrollReveal>

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
          <ExploreSongGrid genre={genre} mood={mood} query={query} />
        </section>
      </main>
    </div>
  )
}
