'use client'

import { ArrowRight } from 'lucide-react'

import { Button } from '@kiyo/ui'

import { ScrollReveal } from '../scroll-reveal'
import { useWaitlist } from '@/lib/waitlist-context'

export function FinalCta() {
  const { show } = useWaitlist()

  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_hsl(var(--kiyo-purple)/0.18),_transparent_60%)]"
      />
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            把
            <span className="bg-gradient-to-r from-kiyo-purple to-kiyo-cyan bg-clip-text text-transparent">
              {' '}
              正在哼的旋律{' '}
            </span>
            变成完整作品
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Kiyo 正在内测中。留下邮箱,加入 Waitlist —— 我们会在产品上线时,第一时间通知你。
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={show} className="group">
              加入 Waitlist
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <a href="#features">先了解能力</a>
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
