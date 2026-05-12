'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { cn } from '@kiyo/ui'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationPanel } from './notification-panel'

interface NotificationBellProps {
  userId: string | undefined
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications(userId)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!userId) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50">
          <NotificationPanel
            notifications={notifications}
            onMarkAsRead={(id) => {
              markAsRead(id)
            }}
            onMarkAllAsRead={() => {
              markAllAsRead()
            }}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  )
}
