'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

import { Button } from '@kiyo/ui'

import { HeroWaveform } from './hero-waveform'
import { useWaitlist } from '@/lib/waitlist-context'

export function Hero() {
  const reduce = useReducedMotion()
  const { show } = useWaitlist()

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-kiyo-radial opacity-90"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-gradient-to-b from-[hsl(var(--kiyo-purple)/0.08)] via-transparent to-transparent dark:from-[hsl(var(--kiyo-purple)/0.18)]"
      />

      <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--kiyo-purple)/0.35)] bg-[hsl(var(--kiyo-purple)/0.08)] px-3 py-1 text-xs font-medium text-foreground/90"
            >
              <Sparkles className="h-3.5 w-3.5 text-kiyo-purple" />
              <span>多模型协同 · AI 音乐工作流</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
            >
              让旋律
              <span className="bg-gradient-to-r from-kiyo-purple to-kiyo-cyan bg-clip-text text-transparent">
                {' '}
                自由生长
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Kiyo 把灵感、编曲、人声、混音一线打通。从一句歌词到一支可发布的作品 —— 每一步都为创作者保留掌控权。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: reduce ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Button size="lg" onClick={show} className="group">
                加入 Waitlist
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <a href="#features">了解能力</a>
              </Button>
            </motion.div>

            <motion.dl
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mt-10 grid max-w-md grid-cols-3 gap-6"
            >
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  模型
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">5+</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  流派
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">30+</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  出品周期
                </dt>
                <dd className="mt-1 text-2xl font-semibold tracking-tight">分钟级</dd>
              </div>
            </motion.dl>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto aspect-[16/10] w-full max-w-xl">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 rounded-3xl border border-border/60 bg-card/50 backdrop-blur-xl"
              />
              <HeroWaveform className="h-full w-full p-8" />
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-3xl shadow-[0_0_120px_-20px_hsl(var(--kiyo-purple)/0.45)]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
