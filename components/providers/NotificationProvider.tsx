'use client'

import { useNotifications } from '@/hooks/useNotifications'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { notifications, unreadCount } = useNotifications()

  // Initialize notifications when user is logged in
  useEffect(() => {
    // Skip initialization on auth pages
    if (pathname?.startsWith('/auth')) return

    // Notifications hook will handle everything automatically
  }, [pathname])

  return <>{children}</>
}