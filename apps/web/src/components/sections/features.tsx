'use client'

import { Layers, Sparkles, Wand2 } from 'lucide-react'

import { Card, CardDescription, CardHeader, CardTitle } from '@kiyo/ui'

import { ScrollReveal } from '../scroll-reveal'

const features = [
  {
    icon: Sparkles,
    title: '多模型协同',
    description:
      '聚合主流 AI 音乐与文本模型,在同一时间轴上接力工作 —— 灵感、旋律、人声、混音各司其职,创作者在中间做指挥。',
  },
  {
    icon: Layers,
    title: '可控的创作过程',
    description:
      '不是黑盒一键出歌。歌词、调性、流派、人声、节奏、停顿,每一步都暴露给你 —— SUNO 化的随性,还是制作人级别的精雕细琢,你决定。',
  },
  {
    icon: Wand2,
    title: '从灵感到成品',
    description:
      '一站式工作流:草稿、协同编辑、版本化记录、封面与歌词管理、导出发布。再也不用在十款工具之间来回切换。',
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            产品能力
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            为创作者重新设计的 AI 工作流
          </h2>
          <p className="mt-4 text-muted-foreground">
            不只是生成,而是协同。让 AI 成为你乐队里的合伙人,而不是替代你的按钮。
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((feature, idx) => (
            <ScrollReveal key={feature.title} delay={idx * 0.1}>
              <Card className="h-full bg-card/60 backdrop-blur-sm transition-colors hover:border-[hsl(var(--kiyo-purple)/0.4)]">
                <CardHeader>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--kiyo-purple)/0.12)] text-kiyo-purple">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">{feature.title}</CardTitle>
                  <CardDescription className="mt-2 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
