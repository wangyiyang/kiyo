import { Link } from '@/i18n/navigation'
import { Github, Mail, Twitter } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Separator } from '@kiyo/ui'

const groupKeys = ['product', 'resources', 'about'] as const
type GroupKey = (typeof groupKeys)[number]

const groupLinks: Record<GroupKey, { href: string; key: string }[]> = {
  product: [
    { href: '#features', key: 'features' },
    { href: '#how', key: 'howItWorks' },
    { href: '#showcase', key: 'showcase' },
  ],
  resources: [
    { href: '#', key: 'docs' },
    { href: '#', key: 'roadmap' },
    { href: '#', key: 'changelog' },
  ],
  about: [
    { href: '#', key: 'team' },
    { href: '#', key: 'contact' },
    { href: '#', key: 'privacy' },
  ],
}

const social = [
  { href: 'https://github.com/wangyiyang/kiyo', icon: Github, label: 'GitHub' },
  { href: '#', icon: Twitter, label: 'Twitter' },
  { href: 'mailto:hello@kiyo.ai', icon: Mail, label: 'Email' },
]

export function SiteFooter() {
  const t = useTranslations('footer')
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="container mx-auto px-4 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Kiyo
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t('tagline')}
            </p>
          </div>
          {groupKeys.map((groupKey) => (
            <div key={groupKey}>
              <h3 className="text-sm font-medium">
                {t(`groups.${groupKey}.title`)}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {groupLinks[groupKey].map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {t(`groups.${groupKey}.links.${link.key}`)}
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
            {t('copyright', { year })}
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
