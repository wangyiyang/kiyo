'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@kiyo/supabase'

interface Notification {
  id: string
  user_id: string
  song_id: string | null
  album_id: string | null
  type: string
  subtype: string
  template_key: string
  template_params: Record<string, string>
  is_read: boolean
  created_at: string
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const response = await fetch('/api/notifications?limit=50')
      if (!response.ok) return
      const { data } = await response.json()
      setNotifications(data || [])
      setUnreadCount((data || []).filter((n: Notification) => !n.is_read).length)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    fetchNotifications()
  }, [userId, fetchNotifications])

  useEffect(() => {
    if (!userId) return

    const supabase = createBrowserClient()
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setNotifications((prev) => [newNotification, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/notifications/${id}/read`, {
          method: 'PATCH',
        })
        if (!response.ok) return

        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    },
    []
  )

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
      })
      if (!response.ok) return

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }, [])

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead }
}
