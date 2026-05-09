import { createClient } from '@supabase/supabase-js'
import { ScrollReveal } from '../scroll-reveal'

interface FeaturedTrack {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  duration: number | null
}

const trackGradients = [
  'from-indigo-500 to-cyan-400',
  'from-amber-400 to-pink-400',
  'from-rose-500 to-violet-500',
  'from-sky-500 to-emerald-400',
  'from-fuchsia-500 to-orange-400',
  'from-purple-400 to-pink-300',
]

async function getFeaturedTracks(): Promise<FeaturedTrack[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars')
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, genre, mood, cover_url, duration')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    console.error('Failed to fetch featured tracks:', error)
    return []
  }

  return (data as FeaturedTrack[]) ?? []
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export async function Showcase() {
  const tracks = await getFeaturedTracks()

  if (!tracks || tracks.length === 0) {
    return null
  }

  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Featured Works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Created with Kiyo
          </h2>
          <p className="mt-4 text-muted-foreground">
            Discover what creators are making with AI-powered music generation.
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((track, idx) => (
            <ScrollReveal key={track.id} delay={(idx % 3) * 0.08}>
              <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card">
                {track.cover_url ? (
                  <img
                    src={track.cover_url}
                    alt={track.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${trackGradients[idx % trackGradients.length]} opacity-90 transition-transform duration-700 group-hover:scale-105`}
                  />
                )}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_85%)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {track.genre ?? 'Music'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    {track.title}
                  </h3>
                  <p className="mt-1 text-xs opacity-75">
                    {track.mood ?? 'Various'} · {formatDuration(track.duration)}
                  </p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
