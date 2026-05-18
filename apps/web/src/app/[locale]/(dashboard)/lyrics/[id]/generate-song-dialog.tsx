'use client'

import * as React from 'react'
import { useRouter } from '@/i18n/navigation'
import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Textarea,
	toast,
} from '@kiyo/ui'
import { Music } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface GenerateSongDialogProps {
	lyricId: string
	lyricTitle: string
	lyricContent: string
	lyricLanguage: string | null
}

/* ── 子组件 ── */

interface SongFormFieldsProps {
	prompt: string
	genre: string
	mood: string
	language: string
	lyricContent: string
	contentEmpty: boolean
	generating: boolean
	t: ReturnType<typeof useTranslations>
	tCommon: ReturnType<typeof useTranslations>
	tLocale: ReturnType<typeof useTranslations>
	onPromptChange: (v: string) => void
	onGenreChange: (v: string) => void
	onMoodChange: (v: string) => void
	onLanguageChange: (v: string) => void
}

function SongFormFields({
	prompt,
	genre,
	mood,
	language,
	lyricContent,
	contentEmpty,
	generating,
	t,
	tCommon,
	tLocale,
	onPromptChange,
	onGenreChange,
	onMoodChange,
	onLanguageChange,
}: SongFormFieldsProps) {
	const LANGUAGE_OPTIONS = [
		{ value: '', label: tCommon('actions.optional') },
		{ value: 'zh', label: tLocale('zh') },
		{ value: 'en', label: tLocale('en') },
		{ value: 'ja', label: tLocale('ja') },
	]

	return (
		<div className="space-y-4 py-2">
			{contentEmpty && (
				<p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
					{t('emptyWarning')}
				</p>
			)}

			<div>
				<Label htmlFor="prompt">{t('fields.prompt')} *</Label>
				<Textarea
					id="prompt"
					value={prompt}
					onChange={(e) => onPromptChange(e.target.value)}
					placeholder={t('placeholders.prompt')}
					rows={2}
					disabled={generating || contentEmpty}
				/>
			</div>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<Label htmlFor="genre">{t('fields.genre')}</Label>
					<Input
						id="genre"
						value={genre}
						onChange={(e) => onGenreChange(e.target.value)}
						placeholder={t('placeholders.genre')}
						disabled={generating || contentEmpty}
					/>
				</div>
				<div>
					<Label htmlFor="mood">{t('fields.mood')}</Label>
					<Input
						id="mood"
						value={mood}
						onChange={(e) => onMoodChange(e.target.value)}
						placeholder={t('placeholders.mood')}
						disabled={generating || contentEmpty}
					/>
				</div>
			</div>

			<div>
				<Label htmlFor="language">{t('fields.language')}</Label>
				<select
					id="language"
					value={language}
					onChange={(e) => onLanguageChange(e.target.value)}
					disabled={generating || contentEmpty}
					className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
				>
					{LANGUAGE_OPTIONS.map((opt) => (
						<option key={opt.value} value={opt.value}>
							{opt.label}
						</option>
					))}
				</select>
			</div>

			<div>
				<Label>{t('preview')}</Label>
				<div className="mt-1 max-h-24 overflow-y-auto rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
					{lyricContent.length > 200
						? lyricContent.slice(0, 200) + '...'
						: lyricContent || t('noContent')}
				</div>
			</div>
		</div>
	)
}

function SuccessContent({
	t,
	tCommon,
	onViewSong,
	onContinue,
}: {
	t: ReturnType<typeof useTranslations>
	tCommon: ReturnType<typeof useTranslations>
	onViewSong: () => void
	onContinue: () => void
}) {
	return (
		<>
			<DialogHeader>
				<DialogTitle>{t('successTitle')}</DialogTitle>
			</DialogHeader>
			<div className="py-4">
				<p className="text-center text-muted-foreground">
					{t('successDescription')}
				</p>
			</div>
			<DialogFooter className="gap-2">
				<Button variant="outline" onClick={onContinue}>
					{t('continueHere')}
				</Button>
				<Button onClick={onViewSong}>
					{t('viewSong')}
				</Button>
			</DialogFooter>
		</>
	)
}

function FormContent({
	t,
	tCommon,
	generating,
	contentEmpty,
	onSubmit,
	onCancel,
	children,
}: {
	t: ReturnType<typeof useTranslations>
	tCommon: ReturnType<typeof useTranslations>
	generating: boolean
	contentEmpty: boolean
	onSubmit: () => void
	onCancel: () => void
	children: React.ReactNode
}) {
	return (
		<>
			<DialogHeader>
				<DialogTitle>{t('title')}</DialogTitle>
			</DialogHeader>
			{children}
			<DialogFooter className="gap-2">
				<Button variant="outline" onClick={onCancel} disabled={generating}>
					{tCommon('actions.cancel')}
				</Button>
				<Button onClick={onSubmit} disabled={generating || contentEmpty}>
					{generating ? tCommon('states.generating') : t('submit')}
				</Button>
			</DialogFooter>
		</>
	)
}

/* ── 主组件 ── */

export function GenerateSongDialog({
	lyricId,
	lyricTitle,
	lyricContent,
	lyricLanguage,
}: GenerateSongDialogProps) {
	const router = useRouter()
	const t = useTranslations('lyrics.generateSong')
	const tCommon = useTranslations('common')
	const tLocale = useTranslations('localeSwitcher')

	const [open, setOpen] = React.useState(false)
	const [generating, setGenerating] = React.useState(false)
	const [prompt, setPrompt] = React.useState(lyricTitle)
	const [genre, setGenre] = React.useState('')
	const [mood, setMood] = React.useState('')
	const [language, setLanguage] = React.useState(lyricLanguage ?? '')
	const [error, setError] = React.useState('')
	const [generatedSongId, setGeneratedSongId] = React.useState<string | null>(null)

	const contentEmpty = !lyricContent || lyricContent.trim() === ''

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			setError(tCommon('errors.required'))
			return
		}

		setGenerating(true)
		setError('')

		try {
			const res = await fetch('/api/songs/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: prompt.trim(),
					mode: 'existing_lyric',
					lyric_id: lyricId,
					genre: genre || undefined,
					mood: mood || undefined,
					language: language || undefined,
				}),
			})
			const data = await res.json()
			if (res.ok && data.song) {
				setGeneratedSongId(data.song.id)
			} else {
				setError(data.error?.message || tCommon('errors.unknown'))
			}
		} catch {
			setError(tCommon('errors.network'))
		} finally {
			setGenerating(false)
		}
	}

	const handleViewSong = () => {
		setOpen(false)
		router.push(`/songs/${generatedSongId}`)
	}

	const handleContinue = () => {
		setOpen(false)
		setGeneratedSongId(null)
		toast.success(t('successMessage'))
	}

	const handleDialogClose = (isOpen: boolean) => {
		if (!isOpen) {
			setGeneratedSongId(null)
		}
		setOpen(isOpen)
	}

	return (
		<Dialog open={open} onOpenChange={handleDialogClose}>
			<Button size="sm" onClick={() => setOpen(true)}>
				<Music className="mr-1 h-4 w-4" />
				{t('submit')}
			</Button>
			<DialogContent className="sm:max-w-lg">
				{generatedSongId ? (
					<SuccessContent
						t={t}
						tCommon={tCommon}
						onViewSong={handleViewSong}
						onContinue={handleContinue}
					/>
				) : (
					<FormContent
						t={t}
						tCommon={tCommon}
						generating={generating}
						contentEmpty={contentEmpty}
						onSubmit={handleGenerate}
						onCancel={() => setOpen(false)}
					>
						<SongFormFields
							prompt={prompt}
							genre={genre}
							mood={mood}
							language={language}
							lyricContent={lyricContent}
							contentEmpty={contentEmpty}
							generating={generating}
							t={t}
							tCommon={tCommon}
							tLocale={tLocale}
							onPromptChange={setPrompt}
							onGenreChange={setGenre}
							onMoodChange={setMood}
							onLanguageChange={setLanguage}
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</FormContent>
				)}
			</DialogContent>
		</Dialog>
	)
}