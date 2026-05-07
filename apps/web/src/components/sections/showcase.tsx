'use client'

import { ScrollReveal } from '../scroll-reveal'

const showcase = [
  {
    title: '城市夜行',
    genre: 'Synthwave',
    mood: '冷色 · 漂浮',
    gradient: 'from-indigo-500 to-cyan-400',
  },
  {
    title: '夏末候鸟',
    genre: 'Lofi · City Pop',
    mood: '暖色 · 慵懒',
    gradient: 'from-amber-400 to-pink-400',
  },
  {
    title: '黑石之心',
    genre: 'Cinematic Rock',
    mood: '高反差 · 张力',
    gradient: 'from-rose-500 to-violet-500',
  },
  {
    title: '潮汐 04:00',
    genre: 'Ambient Electronic',
    mood: '深空 · 静默',
    gradient: 'from-sky-500 to-emerald-400',
  },
  {
    title: '十二楼电台',
    genre: 'Future Funk',
    mood: '高饱和 · 律动',
    gradient: 'from-fuchsia-500 to-orange-400',
  },
  {
    title: '失重花园',
    genre: 'Dream Pop',
    mood: '柔光 · 漂浮',
    gradient: 'from-purple-400 to-pink-300',
  },
]

export function Showcase() {
  return (
    <section id="showcase" className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            作品集预览
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            创作者用 Kiyo 做出的样片
          </h2>
          <p className="mt-4 text-muted-foreground">
            从 Synthwave 到 Cinematic,从 Lofi 到 Future Funk —— 流派只是起点。
          </p>
        </ScrollReveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {showcase.map((item, idx) => (
            <ScrollReveal key={item.title} delay={(idx % 3) * 0.08}>
              <article className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card">
                <div
                  aria-hidden
                  className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-90 transition-transform duration-700 group-hover:scale-105`}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_85%)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xs uppercase tracking-wider opacity-80">
                    {item.genre}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-xs opacity-75">{item.mood}</p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
