'use client'

import { ScrollReveal } from '../scroll-reveal'

const steps = [
  {
    step: '01',
    title: '描述灵感',
    description: '一句歌词、一个画面、或一段心情。Kiyo 会把它解析为流派、情绪与段落骨架。',
  },
  {
    step: '02',
    title: '协同生成',
    description: '多模型并行起稿:主歌、副歌、间奏多版本对比。你挑选,它继续推进。',
  },
  {
    step: '03',
    title: '精修与人声',
    description: '调整节奏、转调、替换音色,加入 AI 人声 —— 男声女声、咬字风格皆可指定。',
  },
  {
    step: '04',
    title: '混音与发布',
    description: '一键母带处理,导出无损或流媒体格式 —— 从灵感到上线,分钟级闭环。',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="bg-muted/30 py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            工作流
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            四步,从灵感到成品
          </h2>
          <p className="mt-4 text-muted-foreground">
            每一步都让创作者掌控,而不是被流程牵着走。
          </p>
        </ScrollReveal>

        <div className="relative mt-14">
          <div
            aria-hidden
            className="absolute left-1/2 top-8 hidden h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[hsl(var(--kiyo-purple)/0.4)] to-transparent md:block"
          />
          <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((s, idx) => (
              <li key={s.step} className="relative">
                <ScrollReveal delay={idx * 0.1}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[hsl(var(--kiyo-purple)/0.35)] bg-background text-base font-semibold tracking-wide text-kiyo-purple shadow-[0_0_40px_-10px_hsl(var(--kiyo-purple)/0.5)]">
                    {s.step}
                  </div>
                  <h3 className="mt-4 text-center text-lg font-semibold">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
                    {s.description}
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
