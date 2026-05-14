'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@kiyo/ui'

import { Link } from '@/i18n/navigation'
import { ScrollReveal } from '../scroll-reveal'
import { InlineWaitlistForm } from '../inline-waitlist-form'

export interface FinalCtaProps {
  isAuthenticated?: boolean
}

export function FinalCta({ isAuthenticated = false }: FinalCtaProps) {
  const t = useTranslations('finalCta')

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_hsl(var(--kiyo-purple)/0.18),_transparent_60%)]"
      />
      <div className="container mx-auto px-4">
        {isAuthenticated ? (
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {t('authenticated.headline')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('authenticated.description')}
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link href="/dashboard">{t('authenticated.cta')}</Link>
              </Button>
            </div>
          </ScrollReveal>
        ) : (
          <ScrollReveal className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              {t('headline.prefix')}
              <span className="bg-gradient-to-r from-kiyo-purple to-kiyo-cyan bg-clip-text text-transparent">
                {' '}
                {t('headline.highlight')}
                {' '}
              </span>
              {t('headline.suffix')}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('description')}
            </p>
            <div className="mx-auto mt-8 max-w-md">
              <InlineWaitlistForm />
            </div>
          </ScrollReveal>
        )}
      </div>
    </section>
  )
}
