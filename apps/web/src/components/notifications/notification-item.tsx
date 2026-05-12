'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@kiyo/ui'
import { zhCN, enUS } from 'date-fns/locale'
import { useLocale } from 'next-intl'

interface Notification {
  id: string
  song_id: string | null
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

interface NotificationItemProps {
  notification: Notification
  onRead: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()
  const t = useTranslations()
  const locale = useLocale()

  const text = t(notification.template_key, notification.template_params)
  const dateLocale = locale === 'zh' ? zhCN : enUS

  const handleClick = () => {
    if (!notification.is_read) {
      onRead(notification.id)
    }
    if (notification.song_id) {
      router.push(`/${locale}/songs/${notification.song_id}`)
    }
  }

  return (
    <button
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
        !notification.is_read && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
      onClick={handleClick}
    >
      {!notification.is_read && (
        <div
          className={cn(
            'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
            notification.subtype === 'failed' ? 'bg-red-500' : 'bg-blue-500'
          )}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm leading-relaxed',
            notification.is_read
              ? 'text-muted-foreground'
              : 'text-foreground'
          )}
        >
          {text}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: dateLocale,
          })}
        </p>
      </div>
    </button>
  )
}
