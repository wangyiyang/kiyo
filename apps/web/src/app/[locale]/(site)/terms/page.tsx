import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { CalendarDays } from 'lucide-react'

import { Separator } from '@kiyo/ui'

interface SectionProps {
	title: string
	children: React.ReactNode
}

function Section({ title, children }: SectionProps) {
	return (
		<section className="mb-8">
			<h2 className="mb-4 text-xl font-semibold">{title}</h2>
			<div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
				{children}
			</div>
		</section>
	)
}

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('legal.terms')
	return {
		title: t('title'),
		description: t('description'),
	}
}

export default async function TermsPage() {
	const t = await getTranslations('legal.terms')

	return (
		<div className="container mx-auto max-w-3xl px-4 py-12">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
				<div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
					<CalendarDays className="h-4 w-4" />
					<span>{t('lastUpdated')}</span>
				</div>
			</div>

			<Separator className="mb-10" />

			<div className="prose prose-sm max-w-none">
				<Section title={t('sections.intro.title')}>
					<p>{t('sections.intro.p1')}</p>
					<p>{t('sections.intro.p2')}</p>
				</Section>

				<Section title={t('sections.service.title')}>
					<p>{t('sections.service.p1')}</p>
					<p>{t('sections.service.p2')}</p>
				</Section>

				<Section title={t('sections.account.title')}>
					<p>{t('sections.account.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.account.items.register')}</li>
						<li>{t('sections.account.items.accurate')}</li>
						<li>{t('sections.account.items.security')}</li>
						<li>{t('sections.account.items.age')}</li>
					</ul>
				</Section>

				<Section title={t('sections.content.title')}>
					<p>{t('sections.content.p1')}</p>
					<p>{t('sections.content.p2')}</p>
				</Section>

				<Section title={t('sections.prohibited.title')}>
					<p>{t('sections.prohibited.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.prohibited.items.illegal')}</li>
						<li>{t('sections.prohibited.items.infringe')}</li>
						<li>{t('sections.prohibited.items.harmful')}</li>
						<li>{t('sections.prohibited.items.spam')}</li>
					</ul>
				</Section>

				<Section title={t('sections.changes.title')}>
					<p>{t('sections.changes.p1')}</p>
				</Section>

				<Section title={t('sections.termination.title')}>
					<p>{t('sections.termination.p1')}</p>
				</Section>

				<Section title={t('sections.disclaimer.title')}>
					<p>{t('sections.disclaimer.p1')}</p>
					<p>{t('sections.disclaimer.p2')}</p>
				</Section>

				<Section title={t('sections.law.title')}>
					<p>{t('sections.law.p1')}</p>
				</Section>

				<Section title={t('sections.contact.title')}>
					<p>{t('sections.contact.p1')}</p>
					<p className="font-medium text-foreground">hello@kiyo.ai</p>
				</Section>
			</div>
		</div>
	)
}