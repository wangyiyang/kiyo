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
	const t = await getTranslations('legal.privacy')
	return {
		title: t('title'),
		description: t('description'),
	}
}

export default async function PrivacyPage() {
	const t = await getTranslations('legal.privacy')

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

				<Section title={t('sections.collection.title')}>
					<p>{t('sections.collection.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.collection.items.email')}</li>
						<li>{t('sections.collection.items.content')}</li>
						<li>{t('sections.collection.items.usage')}</li>
						<li>{t('sections.collection.items.cookies')}</li>
					</ul>
				</Section>

				<Section title={t('sections.usage.title')}>
					<p>{t('sections.usage.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.usage.items.service')}</li>
						<li>{t('sections.usage.items.personalization')}</li>
						<li>{t('sections.usage.items.ai')}</li>
						<li>{t('sections.usage.items.communication')}</li>
					</ul>
				</Section>

				<Section title={t('sections.storage.title')}>
					<p>{t('sections.storage.p1')}</p>
					<p>{t('sections.storage.p2')}</p>
				</Section>

				<Section title={t('sections.thirdParty.title')}>
					<p>{t('sections.thirdParty.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.thirdParty.items.supabase')}</li>
						<li>{t('sections.thirdParty.items.minimax')}</li>
						<li>{t('sections.thirdParty.items.vercel')}</li>
					</ul>
				</Section>

				<Section title={t('sections.rights.title')}>
					<p>{t('sections.rights.p1')}</p>
					<ul className="list-disc space-y-1 pl-5">
						<li>{t('sections.rights.items.access')}</li>
						<li>{t('sections.rights.items.correction')}</li>
						<li>{t('sections.rights.items.deletion')}</li>
						<li>{t('sections.rights.items.withdraw')}</li>
					</ul>
					<p className="mt-3">{t('sections.rights.contact')}</p>
				</Section>

				<Section title={t('sections.security.title')}>
					<p>{t('sections.security.p1')}</p>
				</Section>

				<Section title={t('sections.changes.title')}>
					<p>{t('sections.changes.p1')}</p>
				</Section>

				<Section title={t('sections.contact.title')}>
					<p>{t('sections.contact.p1')}</p>
					<p className="font-medium text-foreground">hello@kiyo.ai</p>
				</Section>
			</div>
		</div>
	)
}