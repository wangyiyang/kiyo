import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Home } from 'lucide-react'
import { Button } from '@kiyo/ui'

export default function NotFoundPage() {
	const t = useTranslations('notFound')

	return (
		<div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
			<h2 className="text-2xl font-bold">{t('title')}</h2>
			<p className="mt-4 text-lg text-muted-foreground">{t('description')}</p>
			<Button asChild className="mt-8">
				<Link href="/">
					<Home className="mr-2 h-4 w-4" />
					{t('backToHome')}
				</Link>
			</Button>
		</div>
	)
}
