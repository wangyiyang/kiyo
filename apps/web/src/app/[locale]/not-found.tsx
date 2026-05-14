import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { useTranslations } from 'next-intl'

export default function NotFoundPage() {
  const t = useTranslations('notFound')

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
      </main>
      <SiteFooter />
    </div>
  )
}
