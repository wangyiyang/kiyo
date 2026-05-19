'use client'

import { useEffect, useState } from 'react'
import { Button } from '@kiyo/ui'
import { X } from 'lucide-react'

const CONSENT_KEY = 'kiyo-cookie-consent'

export function CookieConsent() {
	const [visible, setVisible] = useState(false)

	useEffect(() => {
		try {
			const agreed = localStorage.getItem(CONSENT_KEY)
			if (!agreed) setVisible(true)
		} catch {
			// ignore storage errors
		}
	}, [])

	const accept = () => {
		try {
			localStorage.setItem(CONSENT_KEY, 'true')
		} catch {
			// ignore
		}
		setVisible(false)
	}

	if (!visible) return null

	return (
		<div
			role="dialog"
			aria-label="Cookie consent"
			className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-xl border bg-background/95 p-4 shadow-lg backdrop-blur-sm md:bottom-6 md:left-6 md:right-auto"
		>
			<div className="flex items-start gap-3">
				<div className="flex-1 text-sm">
					<p className="font-medium">We value your privacy</p>
					<p className="mt-1 text-muted-foreground">
						We use cookies and similar technologies to enhance your experience, analyze traffic,
						and serve relevant content. By continuing, you agree to our use of cookies.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button size="sm" onClick={accept}>
						Accept
					</Button>
					<button
						onClick={accept}
						className="rounded-md p-1 text-muted-foreground hover:text-foreground"
						aria-label="Dismiss cookie notice"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	)
}
