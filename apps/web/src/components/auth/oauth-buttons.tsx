'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { signInWithOAuth } from '@/app/actions/auth'
import { Button } from '@kiyo/ui'
import { Github, Chrome } from 'lucide-react'

export function OAuthButtons() {
	const t = useTranslations('auth')
	const searchParams = useSearchParams()
	const redirectTo = searchParams.get('redirectTo') ?? undefined
	const [isPending, startTransition] = React.useTransition()

	const handleGitHubSignIn = () => {
		startTransition(() => {
			signInWithOAuth('github', redirectTo)
		})
	}

	const handleGoogleSignIn = () => {
		startTransition(() => {
			signInWithOAuth('google', redirectTo)
		})
	}

	return (
		<div className="flex flex-col gap-3">
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handleGitHubSignIn}
				disabled={isPending}
				aria-busy={isPending}
			>
				<Github className="mr-2 h-4 w-4" />
				{t('oauth.github')}
			</Button>
			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handleGoogleSignIn}
				disabled={isPending}
				aria-busy={isPending}
			>
				<Chrome className="mr-2 h-4 w-4" />
				{t('oauth.google')}
			</Button>
		</div>
	)
}
