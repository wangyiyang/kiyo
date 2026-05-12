'use client'

import { useTranslations } from 'next-intl'
import { signInWithOAuth } from '@/app/actions/auth'
import { Button } from '@kiyo/ui'
import { Github, Chrome } from 'lucide-react'

export function OAuthButtons() {
	const t = useTranslations('auth')

	const handleGitHubSignIn = () => {
		signInWithOAuth('github')
	}

	const handleGoogleSignIn = () => {
		signInWithOAuth('google')
	}

	return (
		<div className="flex flex-col gap-3">
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handleGitHubSignIn}
			>
				<Github className="mr-2 h-4 w-4" />
				{t('oauth.github')}
			</Button>
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handleGoogleSignIn}
			>
				<Chrome className="mr-2 h-4 w-4" />
				{t('oauth.google')}
			</Button>
		</div>
	)
}