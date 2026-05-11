'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kiyo/ui'
import { Share2, Link2, Twitter } from 'lucide-react'
import { toast } from 'sonner'

interface ShareButtonProps {
  entityType: 'song' | 'album'
  entityId: string
  title: string
  isPublic: boolean
  locale: string
}

export function ShareButton({ entityType, entityId, title, isPublic, locale }: ShareButtonProps) {
  const t = useTranslations('share')
  const [copied, setCopied] = useState(false)
  const [makingPublic, setMakingPublic] = useState(false)

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${locale}/${entityType}s/${entityId}/public`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      toast.success(t('copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const handleTwitter = () => {
    const text = encodeURIComponent(`${title} — ${t('twitterText')}`)
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(publicUrl)}`,
      '_blank'
    )
  }

  const handleMakePublic = async () => {
    setMakingPublic(true)
    try {
      const res = await fetch(`/api/${entityType}s/${entityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || 'Failed')
      }
      await navigator.clipboard.writeText(publicUrl)
      toast.success(t('madePublic'))
      window.location.reload()
    } catch {
      toast.error(t('makePublicFailed'))
    } finally {
      setMakingPublic(false)
    }
  }

  if (!isPublic) {
    return (
      <Button variant="outline" size="sm" onClick={handleMakePublic} disabled={makingPublic}>
        <Share2 className="mr-1 h-4 w-4" />
        {makingPublic ? t('makingPublic') : t('button')}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-1 h-4 w-4" />
          {t('button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy}>
          <Link2 className="mr-2 h-4 w-4" />
          {copied ? t('copied') : t('copyLink')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleTwitter}>
          <Twitter className="mr-2 h-4 w-4" />
          {t('shareTwitter')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
