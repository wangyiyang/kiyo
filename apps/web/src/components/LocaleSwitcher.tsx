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

import { useSetLocale } from '@/i18n/client'

const locales = [
	{ code: 'en', label: 'English' },
	{ code: 'zh', label: '中文' },
] as const

export function LocaleSwitcher() {
	const currentLocale = useLocale()
	const setLocale = useSetLocale()
	const t = useTranslations('localeSwitcher')

	const handleChange = (nextLocale: 'en' | 'zh') => {
		setLocale(nextLocale)
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
