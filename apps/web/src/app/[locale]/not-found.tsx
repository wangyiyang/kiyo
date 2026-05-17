'use client'

import { Link } from '@/i18n/navigation'
import { Music2, Home, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Button } from '@kiyo/ui'

export default function NotFoundPage() {
	const t = useTranslations('notFound')

	return (
		<div className="flex min-h-screen flex-col">
			<SiteHeader />
			<main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
				{/* 背景渐变效果 */}
				<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_hsl(var(--kiyo-purple)/0.15),_transparent_60%)]" />

				{/* 404 错误码 */}
				<div className="mb-6 select-none">
					<span className="bg-gradient-to-r from-kiyo-purple to-kiyo-cyan bg-clip-text text-[120px] font-bold leading-none tracking-tight text-transparent drop-shadow-lg md:text-[160px]">
						{t('errorCode')}
					</span>
				</div>

				{/* Logo 标识 */}
				<div className="mb-8 flex items-center gap-3">
					<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-kiyo-purple to-kiyo-cyan text-white shadow-[0_0_40px_-8px_hsl(var(--kiyo-purple)/0.6)]">
						<Music2 className="h-6 w-6" />
					</span>
					<span className="text-2xl font-bold tracking-tight">Kiyo</span>
				</div>

				{/* 标题和描述 */}
				<div className="mb-10 text-center">
					<h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
					<p className="mt-3 text-lg text-muted-foreground">{t('description')}</p>
				</div>

				{/* 导航按钮 */}
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button asChild size="lg">
						<Link href="/">
							<Home className="mr-2 h-4 w-4" />
							{t('backToHome')}
						</Link>
					</Button>
					<Button asChild variant="outline" size="lg">
						<Link href="/explore">
							<Search className="mr-2 h-4 w-4" />
							{t('exploreMusic')}
						</Link>
					</Button>
				</div>
			</main>
			<SiteFooter />
		</div>
	)
}