import { useTranslations } from 'next-intl'

export default function NotFoundPage() {
  const t = useTranslations('notFound')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h2 className="text-2xl font-bold">{t('title')}</h2>
      <p className="mt-4 text-lg">{t('description')}</p>
    </div>
  )
}
