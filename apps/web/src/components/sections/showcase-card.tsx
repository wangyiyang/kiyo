'use client'

import Image from 'next/image'
import { Play, VolumeX } from 'lucide-react'
import { usePlayerStore, cn, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@kiyo/ui'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { normalizeTag } from '@/lib/tag-normalization'

interface Track {
  id: string
  title: string
  genre: string | null
  mood: string | null
  cover_url: string | null
  cover_file_path: string | null
  audio_url: string | null
  file_path: string | null
  duration: number | null
}

interface ShowcaseCardProps {
  track: Track
  index: number
  playlist: Track[]
  gradient: string
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

async function getSignedCoverUrl(filePath: string | null): Promise<string | null> {
  if (!filePath) return null
  try {
    const res = await fetch('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket: 'covers', path: filePath }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.signedUrl as string
  } catch {
    return null
  }
}

export function ShowcaseCard({ track, index, playlist, gradient }: ShowcaseCardProps) {
  const play = usePlayerStore((s) => s.play)
  const t = useTranslations('common')
  const tExplore = useTranslations('explore')
  const [coverUrl, setCoverUrl] = useState<string | null>(track.cover_url)

  useEffect(() => {
    // API already pre-signed the cover_url — use it directly
    if (track.cover_url) {
      setCoverUrl(track.cover_url)
      return
    }
    // Fallback: client-side signing for legacy/un-signed tracks
    if (track.cover_file_path) {
      getSignedCoverUrl(track.cover_file_path).then((url) => {
        setCoverUrl(url || null)
      })
    }
  }, [track.cover_url, track.cover_file_path])

  const handlePlay = () => {
    if (!track.audio_url && !track.file_path) return

    const playerPlaylist = playlist
      .filter((t) => t.audio_url || t.file_path)
      .map((t) => ({
        id: t.id,
        title: t.title,
        audio_url: t.audio_url || '',
        cover_url: t.cover_url,
        file_path: t.file_path,
        duration: t.duration,
        album: null,
      }))

    play(
      {
        id: track.id,
        title: track.title,
        audio_url: track.audio_url || '',
        cover_url: coverUrl,
        file_path: track.file_path,
        duration: track.duration,
        album: null,
      },
      playerPlaylist
    )
  }

  const hasAudio = !!(track.audio_url || track.file_path)

  return (
    <TooltipProvider delayDuration={300}>
      <article
        className={cn(
          "group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card",
          hasAudio && "cursor-pointer"
        )}
        onClick={handlePlay}
      >
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={track.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={() => setCoverUrl(null)}
        />
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90 transition-transform duration-700 group-hover:scale-105`}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_rgba(0,0,0,0.5)_85%)]"
      />

      {/* Play button overlay */}
      {hasAudio ? (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm ring-1 ring-white/30">
            <Play className="h-6 w-6 fill-white text-white" />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            <VolumeX className="h-3.5 w-3.5" />
            <span>{t('noAudio')}</span>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="text-xs uppercase tracking-wider opacity-80">
          {normalizeTag(track.genre) ?? tExplore('defaultGenre')}
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="line-clamp-1 text-lg font-semibold tracking-tight">
              {track.title}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-xs text-center">
            {track.title}
          </TooltipContent>
        </Tooltip>
        <p className="mt-1 text-xs opacity-75">
          {normalizeTag(track.mood) ?? tExplore('defaultMood')} · {formatDuration(track.duration)}
        </p>
      </div>
    </article>
    </TooltipProvider>
  )
}
