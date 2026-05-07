import { useTranslations } from 'next-intl'
import { Button } from '@kiyo/ui'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'

export default function HomePage() {
  const t = useTranslations('home')

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="mt-4 text-lg">{t('subtitle')}</p>
        <div className="mt-8 flex gap-4">
          <Button>{t('buttons.primary')}</Button>
          <Button variant="secondary">{t('buttons.secondary')}</Button>
          <Button variant="outline">{t('buttons.outline')}</Button>
        </div>
        <div className="mt-8">
          <LocaleSwitcher />
        </div>
      </div>
    </main>
  )
}
