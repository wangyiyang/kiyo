'use client'

import { useTranslations } from 'next-intl'

import { ScrollReveal } from '../scroll-reveal'

const stepKeys = ['describe', 'generate', 'refine', 'release'] as const

export function HowItWorks() {
  const t = useTranslations('howItWorks')

  return (
    <section id="how" className="bg-muted/30 py-20 md:py-28">
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

        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute left-1/2 top-8 hidden h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--kiyo-purple)/0.4)] to-transparent md:block"
          />
          <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
            {stepKeys.map((key, idx) => (
              <li key={key} className="relative">
                <ScrollReveal delay={idx * 0.1}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--kiyo-purple)/0.35)] bg-background text-base font-semibold tracking-wide text-kiyo-purple shadow-[0_0_40px_-10px_hsl(var(--kiyo-purple)/0.5)]">
                    {t(`steps.${key}.step`)}
                  </div>
                  <h3 className="mt-4 text-center text-lg font-semibold">
                    {t(`steps.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${key}.description`)}
                  </p>
                </ScrollReveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
