import Link from 'next/link'
import { Github, Mail, Twitter } from 'lucide-react'

import { Separator } from '@kiyo/ui'

const linkGroups = [
  {
    title: '产品',
    links: [
      { href: '#features', label: '能力' },
      { href: '#how', label: '工作流' },
      { href: '#showcase', label: '作品' },
    ],
  },
  {
    title: '资源',
    links: [
      { href: '#', label: '使用文档' },
      { href: '#', label: 'Roadmap' },
      { href: '#', label: '更新日志' },
    ],
  },
  {
    title: '关于',
    links: [
      { href: '#', label: '团队' },
      { href: '#', label: '联系我们' },
      { href: '#', label: '隐私政策' },
    ],
  },
]

const social = [
  { href: 'https://github.com/wangyiyang/kiyo', icon: Github, label: 'GitHub' },
  { href: '#', icon: Twitter, label: 'Twitter' },
  { href: 'mailto:hello@kiyo.ai', icon: Mail, label: 'Email' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="container mx-auto px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Kiyo
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              基于多模型协同的 AI 音乐创作平台,为创作者提供从灵感到成品的一站式工作流。
            </p>
          </div>
          {linkGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-medium">{group.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Kiyo. 让旋律自由生长。
          </p>
          <div className="flex items-center gap-2">
            {social.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[hsl(var(--kiyo-purple)/0.5)] hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
