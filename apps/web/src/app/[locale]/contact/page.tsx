import { useTranslations } from 'next-intl'
import { Mail } from 'lucide-react'

import { FaqAccordion } from '@/components/faq-accordion'

export default function ContactPage() {
	const t = useTranslations('contact')

	return (
		<div className="container mx-auto max-w-2xl px-4 py-16">
			<div className="mb-12 text-center">
				<h1 className="mb-4 text-4xl font-bold">{t('title')}</h1>
				<p className="text-lg text-muted-foreground">{t('subtitle')}</p>
			</div>

			{/* 联系邮箱 */}
			<div className="mb-12 flex items-center justify-center gap-3 rounded-lg border bg-card p-6">
				<Mail className="h-6 w-6 text-primary" />
				<a
					href="mailto:wangyiyang.kk@gmail.com"
					className="text-lg font-medium hover:underline"
				>
					wangyiyang.kk@gmail.com
				</a>
			</div>

			{/* FAQ */}
			<FaqAccordion />
		</div>
	)
}