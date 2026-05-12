'use client'

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

type Locale = 'en' | 'zh'

interface LocaleContextValue {
	locale: Locale
	setLocale: (locale: Locale) => void
	messages: Record<string, unknown>
	isLoading: boolean
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

const COOKIE_NAME = 'NEXT_LOCALE'
const MESSAGES_CACHE: Record<string, Record<string, unknown>> = {}

export function LocaleProvider({
	children,
	initialLocale,
	initialMessages,
}: {
	children: ReactNode
	initialLocale: Locale
	initialMessages: Record<string, unknown>
}) {
	const [locale, setLocaleState] = useState<Locale>(initialLocale)
	const [messages, setMessages] = useState<Record<string, unknown>>(initialMessages)
	const [isLoading, setIsLoading] = useState(false)
	const router = useRouter()

	const setLocale = useCallback(
		async (newLocale: Locale) => {
			if (newLocale === locale) return

			setIsLoading(true)
			try {
				// Load new locale messages dynamically
				const newMessages =
					MESSAGES_CACHE[newLocale] ||
					(await import(`../../../messages/${newLocale}.json`)).default

				MESSAGES_CACHE[newLocale] = newMessages
				MESSAGES_CACHE[locale] = messages

				// Set cookie
				document.cookie = `${COOKIE_NAME}=${newLocale}; path=/; max-age=31536000`

				// Update state
				setLocaleState(newLocale)
				setMessages(newMessages)

				// Refresh page
				router.refresh()
			} catch (error) {
				console.error('Failed to switch locale:', error)
			} finally {
				setIsLoading(false)
			}
		},
		[locale, messages, router]
	)

	// Sync with cookie on mount
	useEffect(() => {
		const match = document.cookie.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`))
		if (match) {
			const cookieLocale = match[2] as Locale
			if (cookieLocale !== locale) {
				setLocale(cookieLocale)
			}
		}
	}, [locale, setLocale])

	return (
		<LocaleContext.Provider value={{ locale, setLocale, messages, isLoading }}>
			{children}
		</LocaleContext.Provider>
	)
}

const SUPPORTED_LOCALES: Locale[] = ['en', 'zh']

export function useLocale() {
	const ctx = useContext(LocaleContext)
	if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
	return ctx.locale
}

export function useSetLocale() {
	const ctx = useContext(LocaleContext)
	if (!ctx) throw new Error('useSetLocale must be used within LocaleProvider')
	return ctx.setLocale
}

export function useMessages() {
	const ctx = useContext(LocaleContext)
	if (!ctx) throw new Error('useMessages must be used within LocaleProvider')
	return ctx.messages
}

export function useIsLocaleLoading() {
	const ctx = useContext(LocaleContext)
	if (!ctx) throw new Error('useIsLocaleLoading must be used within LocaleProvider')
	return ctx.isLoading
}
