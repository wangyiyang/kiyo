'use client'

import { Layers, Sparkles, Wand2, Mic2, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardDescription, CardHeader, CardTitle } from '@kiyo/ui'

import { ScrollReveal } from '../scroll-reveal'

const featureKeys = ['multiModel', 'controllable', 'endToEnd', 'aiCover'] as const
type FeatureKey = (typeof featureKeys)[number]

const featureIcons: Record<FeatureKey, LucideIcon> = {
  multiModel: Sparkles,
  controllable: Layers,
  endToEnd: Wand2,
  aiCover: Mic2,
}

export function Features() {
  const t = useTranslations('features')

  return (
    <section id="features" className="relative py-20 md:py-28">
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

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featureKeys.map((key, idx) => {
            const Icon = featureIcons[key]
            return (
              <ScrollReveal key={key} delay={idx * 0.1}>
                <Card className="h-full bg-card/60 backdrop-blur-sm transition-colors hover:border-[hsl(var(--kiyo-purple)/0.4)]">
                  <CardHeader>
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--kiyo-purple)/0.12)] text-kiyo-purple">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="mt-4 text-xl">
                      {t(`items.${key}.title`)}
                    </CardTitle>
                    <CardDescription className="mt-2 leading-relaxed">
                      {t(`items.${key}.description`)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
