'use client'

import { useTranslations } from 'next-intl'

import { ScrollReveal } from '../scroll-reveal'

const trackKeys = [
  'cityNight',
  'summerBird',
  'blackstone',
  'tide',
  'radio12',
  'weightlessGarden',
] as const
type TrackKey = (typeof trackKeys)[number]

const trackGradients: Record<TrackKey, string> = {
  cityNight: 'from-indigo-500 to-cyan-400',
  summerBird: 'from-amber-400 to-pink-400',
  blackstone: 'from-rose-500 to-violet-500',
  tide: 'from-sky-500 to-emerald-400',
  radio12: 'from-fuchsia-500 to-orange-400',
  weightlessGarden: 'from-purple-400 to-pink-300',
}

export function Showcase() {
  const t = useTranslations('showcase')

  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('heading')}
          </h2>
          <p className="mt-4 text-muted-foreground">{t('description')}</p>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {trackKeys.map((key, idx) => (
            <ScrollReveal key={key} delay={(idx % 3) * 0.08}>
              <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  aria-hidden
                  className={`absolute inset-0 bg-gradient-to-br ${trackGradients[key]} opacity-90 transition-transform duration-700 group-hover:scale-105`}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_85%)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {t(`tracks.${key}.genre`)}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    {t(`tracks.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-xs opacity-75">
                    {t(`tracks.${key}.mood`)}
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
