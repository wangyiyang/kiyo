'use client'

import { useTranslations } from 'next-intl'
import { NotificationItem } from './notification-item'

interface Notification {
  id: string
  song_id: string | null
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  isLoading: boolean
}

export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  isLoading,
}: NotificationPanelProps) {
  const t = useTranslations()
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="w-[360px] overflow-hidden rounded-xl border bg-popover shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{t('notification.title')}</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllAsRead}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('notification.markAllAsRead')}
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">{t('notification.empty')}</p>
          </div>
        ) : (
          notifications.map((notification, index) => (
            <div key={notification.id}>
              <NotificationItem
                notification={notification}
                onRead={onMarkAsRead}
              />
              {index < notifications.length - 1 && (
                <div className="mx-4 h-px bg-border" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
