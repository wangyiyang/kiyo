'use client'

import { useLocale, useTranslations } from 'next-intl'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@kiyo/ui'
import { Button } from '@kiyo/ui'
import { Globe } from 'lucide-react'

import { usePathname, useRouter } from '@/i18n/navigation'

const locales = [
	{ code: 'en' as const, label: 'English' },
	{ code: 'zh' as const, label: '中文' },
] as const

export function LocaleSwitcher() {
	const currentLocale = useLocale()
	const router = useRouter()
	const pathname = usePathname()
	const t = useTranslations('localeSwitcher')

	const handleChange = (nextLocale: 'en' | 'zh') => {
		if (nextLocale === currentLocale) return
		router.replace(pathname, { locale: nextLocale })
	}

	const currentLabel = locales.find((l) => l.code === currentLocale)?.label ?? currentLocale

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					<Globe className="mr-2 h-4 w-4" />
					{currentLabel}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{locales.map((l) => (
					<DropdownMenuItem
						key={l.code}
						onClick={() => handleChange(l.code)}
						className={currentLocale === l.code ? 'bg-accent' : ''}
					>
						{l.label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
